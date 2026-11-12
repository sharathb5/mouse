import type { ModelProvider } from './provider';

/**
 * Deterministic mock provider for tests and offline demos. Clearly labeled as a mock —
 * never presented as a real model.
 */
export function createMockModelProvider(): ModelProvider {
  return {
    id: 'mock',
    label: 'Mock (deterministic, not a real model)',
    async *stream(request, signal) {
      throwIfAborted(signal);
      const injection = /ignore (all |any )?previous instructions/i.test(request.untrustedContext);
      const preview = request.untrustedContext.replace(/\s+/g, ' ').trim().slice(0, 80);
      const firstLine = request.userInstruction.split('\n')[0] ?? 'request';
      const chunks = injection
        ? [
            '[MOCK] ',
            'Ignoring injection attempts in page content. ',
            `Action stays "${firstLine}". `,
            `Context preview: ${preview || '(empty)'}`,
          ]
        : [
            '[MOCK] ',
            `Response for: ${firstLine}. `,
            preview ? `About: ${preview}` : 'No page text.',
          ];
      for (const chunk of chunks) {
        throwIfAborted(signal);
        await delay(8, signal);
        yield chunk;
      }
    },
  };
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw abortError();
}

function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(abortError());
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(abortError());
      },
      { once: true },
    );
  });
}

function abortError(): Error {
  return new DOMException('Aborted', 'AbortError');
}
