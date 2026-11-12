import { buildDelimitedMessages } from './prompt';
import { ModelProviderError, type ModelProvider } from './provider';

export const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
export const OPENROUTER_HOST_PERMISSION = 'https://openrouter.ai/*';

export interface OpenRouterOptions {
  apiKey: string;
  /** Optional fetch for tests. */
  fetchImpl?: typeof fetch;
  referer?: string;
  title?: string;
}

/**
 * Real OpenRouter chat/completions streaming adapter. Requires an API key from extension
 * settings (background storage only).
 */
export function createOpenRouterProvider(options: OpenRouterOptions): ModelProvider {
  const fetchImpl = options.fetchImpl ?? fetch;
  return {
    id: 'openrouter',
    label: 'OpenRouter',
    async *stream(request, signal) {
      if (!options.apiKey.trim()) {
        throw new ModelProviderError(
          'not-configured',
          'OpenRouter API key is not configured. Add it in the extension settings.',
        );
      }

      const messages = buildDelimitedMessages({
        system: request.system,
        untrustedContext: request.untrustedContext,
        userInstruction: request.userInstruction,
      });

      let response: Response;
      try {
        response = await fetchImpl(OPENROUTER_API_URL, {
          method: 'POST',
          signal,
          headers: {
            Authorization: `Bearer ${options.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': options.referer ?? 'https://github.com/sharathb5/mouse',
            'X-Title': options.title ?? 'Agentic Mouse',
          },
          body: JSON.stringify({
            model: request.modelId,
            messages,
            stream: true,
          }),
        });
      } catch (cause) {
        if (signal.aborted) {
          throw new ModelProviderError('cancelled', 'Request cancelled', { cause });
        }
        throw new ModelProviderError('network', 'Failed to reach OpenRouter', {
          retryable: true,
          cause,
        });
      }

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new ModelProviderError(
          'provider',
          `OpenRouter error ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`,
          { retryable: response.status >= 500 },
        );
      }

      if (!response.body) {
        throw new ModelProviderError('provider', 'OpenRouter returned an empty body');
      }

      yield* iterateSseTextDeltas(response.body, signal);
    },
  };
}

async function* iterateSseTextDeltas(
  body: ReadableStream<Uint8Array>,
  signal: AbortSignal,
): AsyncIterable<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      throwIfAborted(signal);
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') return;
        try {
          const parsed = JSON.parse(data) as {
            choices?: { delta?: { content?: string | null } }[];
          };
          const delta = parsed.choices?.[0]?.delta?.content;
          if (typeof delta === 'string' && delta.length > 0) yield delta;
        } catch {
          // Skip malformed SSE chunks.
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new ModelProviderError('cancelled', 'Request cancelled');
  }
}
