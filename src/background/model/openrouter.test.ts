import { describe, expect, it } from 'vitest';
import { createOpenRouterProvider } from './openrouter';
import { ModelProviderError } from './provider';

describe('OpenRouter provider (MOCKED fetch)', () => {
  it('streams SSE content deltas from a mocked fetch body', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Hi "}}]}\n\n'));
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"there"}}]}\n\n'));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });
    let seenAuth: string | undefined;
    const fetchImpl: typeof fetch = (_url, init) => {
      const headers = init?.headers as Record<string, string> | undefined;
      seenAuth = headers?.Authorization;
      return Promise.resolve(new Response(stream, { status: 200 }));
    };
    const provider = createOpenRouterProvider({ apiKey: 'test-key', fetchImpl });
    const chunks: string[] = [];
    for await (const delta of provider.stream(
      {
        system: 'sys',
        untrustedContext: 'ctx',
        userInstruction: 'Explain',
        modelId: 'openai/gpt-4o-mini',
      },
      new AbortController().signal,
    )) {
      chunks.push(delta);
    }
    expect(chunks.join('')).toBe('Hi there');
    expect(seenAuth).toBe('Bearer test-key');
  });

  it('throws not-configured when the key is empty', async () => {
    const provider = createOpenRouterProvider({ apiKey: '   ' });
    await expect(async () => {
      for await (const delta of provider.stream(
        {
          system: 's',
          untrustedContext: 'u',
          userInstruction: 'i',
          modelId: 'openai/gpt-4o-mini',
        },
        new AbortController().signal,
      )) {
        expect(delta).toBe('unreachable');
      }
    }).rejects.toBeInstanceOf(ModelProviderError);
  });
});
