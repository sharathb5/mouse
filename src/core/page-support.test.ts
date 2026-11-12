import { describe, expect, it } from 'vitest';
import { classifyPageSupport, describeUnsupportedReason } from './page-support';

describe('classifyPageSupport', () => {
  it.each([
    ['https://example.com/', { supported: true }],
    ['http://127.0.0.1:4321/page.html', { supported: true }],
    ['https://chrome.google.com/search', { supported: true }],
    ['chrome://extensions/', { supported: false, reason: 'browser-page' }],
    ['about:blank', { supported: false, reason: 'browser-page' }],
    ['chrome-extension://abc/popup.html', { supported: false, reason: 'extension-page' }],
    ['https://chromewebstore.google.com/detail/x', { supported: false, reason: 'web-store' }],
    ['https://chrome.google.com/webstore/detail/x', { supported: false, reason: 'web-store' }],
    ['file:///tmp/a.html', { supported: false, reason: 'non-web-page' }],
    ['data:text/html,hi', { supported: false, reason: 'non-web-page' }],
    [undefined, { supported: false, reason: 'unknown' }],
    ['not a url', { supported: false, reason: 'unknown' }],
  ])('%s', (url, expected) => {
    expect(classifyPageSupport(url)).toEqual(expected);
  });

  it('has a user-facing explanation for every reason', () => {
    for (const reason of [
      'browser-page',
      'web-store',
      'extension-page',
      'non-web-page',
      'unknown',
    ] as const) {
      expect(describeUnsupportedReason(reason).length).toBeGreaterThan(10);
    }
  });
});
