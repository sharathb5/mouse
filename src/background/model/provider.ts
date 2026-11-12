/**
 * Streaming LLM adapter. Implementations run only in the background service worker so
 * API keys never reach content scripts or pages.
 */
export interface ModelProvider {
  readonly id: string;
  /** Human label; mock providers must say they are a mock. */
  readonly label: string;
  stream(
    request: {
      system: string;
      untrustedContext: string;
      userInstruction: string;
      modelId: string;
    },
    signal: AbortSignal,
  ): AsyncIterable<string>;
}

export class ModelProviderError extends Error {
  readonly code: 'not-configured' | 'network' | 'provider' | 'cancelled';
  readonly retryable: boolean;

  constructor(
    code: ModelProviderError['code'],
    message: string,
    options: { retryable?: boolean; cause?: unknown } = {},
  ) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'ModelProviderError';
    this.code = code;
    this.retryable = options.retryable ?? false;
  }
}
