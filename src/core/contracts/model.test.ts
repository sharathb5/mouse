import { describe, expect, it } from 'vitest';
import {
  ACTION_RUN_PORT,
  ActionRunClientMessageSchema,
  ActionRunServerMessageSchema,
  DEFAULT_OPENROUTER_MODEL,
  MODEL_STREAM_PORT,
  ModelProviderSettingsSchema,
  ModelStreamClientMessageSchema,
  ModelStreamServerMessageSchema,
} from './model';

describe('ModelProviderSettingsSchema', () => {
  it('accepts openrouter settings with a configured flag but never a key field', () => {
    const parsed = ModelProviderSettingsSchema.parse({
      providerId: 'openrouter',
      modelId: DEFAULT_OPENROUTER_MODEL,
      apiKeyConfigured: true,
    });
    expect(parsed).toEqual({
      providerId: 'openrouter',
      modelId: DEFAULT_OPENROUTER_MODEL,
      apiKeyConfigured: true,
    });
    expect(parsed).not.toHaveProperty('apiKey');
  });

  it('labels mock as a distinct provider id', () => {
    expect(
      ModelProviderSettingsSchema.parse({
        providerId: 'mock',
        modelId: 'mock-deterministic',
        apiKeyConfigured: true,
      }).providerId,
    ).toBe('mock');
  });
});

describe('model stream port contracts', () => {
  it('keeps stable port names for content ↔ background streaming', () => {
    expect(MODEL_STREAM_PORT).toBe('agentic-mouse/model-stream');
    expect(ACTION_RUN_PORT).toBe('agentic-mouse/action-run');
  });

  it('validates stream start and abort client messages', () => {
    expect(
      ModelStreamClientMessageSchema.safeParse({
        type: 'start',
        requestId: 'r1',
        system: 'You are helpful.',
        untrustedContext: 'page text',
        userInstruction: 'Explain this.',
      }).success,
    ).toBe(true);
    expect(
      ModelStreamClientMessageSchema.safeParse({ type: 'abort', requestId: 'r1' }).success,
    ).toBe(true);
  });

  it('validates server deltas and errors', () => {
    expect(
      ModelStreamServerMessageSchema.safeParse({
        type: 'delta',
        requestId: 'r1',
        delta: 'Hello',
      }).success,
    ).toBe(true);
    expect(
      ModelStreamServerMessageSchema.safeParse({
        type: 'error',
        requestId: 'r1',
        error: { code: 'provider', message: 'not configured', retryable: false },
      }).success,
    ).toBe(true);
  });

  it('validates action-run envelopes', () => {
    const context = {
      untrusted: true as const,
      source: {
        url: 'https://example.com/',
        title: 'Example',
        capturedAt: '2026-11-12T03:00:00.000Z',
        frame: 'top' as const,
      },
      target: {
        kind: 'element' as const,
        element: {
          kind: 'paragraph' as const,
          confidence: 0.9,
          signals: ['p'],
          sensitive: false,
        },
        text: 'Hello',
        blocks: [{ type: 'paragraph' as const, text: 'Hello' }],
      },
      page: { kind: 'article' as const, confidence: 0.8, signals: ['article'] },
      containsSensitiveData: false,
    };
    expect(
      ActionRunClientMessageSchema.safeParse({
        type: 'start',
        requestId: 'a1',
        actionId: 'explain',
        context,
      }).success,
    ).toBe(true);
    expect(
      ActionRunServerMessageSchema.safeParse({
        type: 'text-delta',
        requestId: 'a1',
        delta: 'Hi',
      }).success,
    ).toBe(true);
  });
});
