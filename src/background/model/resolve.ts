import type { ModelPreferences } from '@/core/contracts';
import { createMockModelProvider } from './mock';
import { createOpenRouterProvider } from './openrouter';
import { ModelProviderError, type ModelProvider } from './provider';

export function resolveModelProvider(
  preferences: ModelPreferences,
  apiKey: string | null,
): ModelProvider {
  if (preferences.providerId === 'mock') {
    return createMockModelProvider();
  }
  if (!apiKey?.trim()) {
    throw new ModelProviderError(
      'not-configured',
      'OpenRouter API key is not configured. Add it under Settings → Inline AI.',
    );
  }
  return createOpenRouterProvider({ apiKey });
}
