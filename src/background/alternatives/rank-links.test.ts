import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { DEFAULT_SETTINGS } from '@/core/contracts';
import { clearModelApiKey, saveModelApiKey } from '@/platform/model-secrets';
import { saveSettings } from '@/platform/settings-store';
import { rankAlternativeLinks } from './rank-links';

describe('rankAlternativeLinks', () => {
  beforeEach(async () => {
    fakeBrowser.reset();
    await saveSettings({
      ...DEFAULT_SETTINGS,
      model: { providerId: 'openrouter', modelId: 'openai/gpt-4o-mini' },
    });
    await clearModelApiKey();
  });

  it('returns honest unconfigured notice when OpenRouter key is missing', async () => {
    const result = await rankAlternativeLinks({
      seed: {
        name: { value: 'Lamp', sourceUrl: 'http://127.0.0.1:4321/a' },
        kind: 'product',
        fields: {},
      },
      links: [{ url: 'http://127.0.0.1:4321/b', text: 'Stand' }],
      signal: new AbortController().signal,
    });
    expect(result.usedOpenRouter).toBe(false);
    expect(result.urls).toEqual([]);
    expect(result.notice).toMatch(/OpenRouter is not configured/i);
  });

  it('keeps only URLs that appeared in the candidate list (MOCKED OpenRouter)', async () => {
    // MOCKED: fake OpenRouter JSON response — not a live provider call.
    await saveModelApiKey('sk-or-test');
    const fetchImpl: typeof fetch = () =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    urls: ['http://127.0.0.1:4321/b', 'https://evil.example/invented'],
                  }),
                },
              },
            ],
          }),
          { status: 200 },
        ),
      );

    const result = await rankAlternativeLinks({
      seed: {
        name: { value: 'Lamp', sourceUrl: 'http://127.0.0.1:4321/a' },
        kind: 'product',
        url: 'http://127.0.0.1:4321/a',
        fields: { price: { value: 10, sourceUrl: 'http://127.0.0.1:4321/a' } },
      },
      links: [
        { url: 'http://127.0.0.1:4321/b', text: 'Stand product' },
        { url: 'http://127.0.0.1:4321/c', text: 'Mat' },
      ],
      signal: new AbortController().signal,
      fetchImpl,
    });

    expect(result.usedOpenRouter).toBe(true);
    expect(result.urls).toEqual(['http://127.0.0.1:4321/b']);
    expect(result.urls).not.toContain('https://evil.example/invented');
  });
});
