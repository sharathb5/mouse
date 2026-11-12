import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { getTabStatus } from './tab-status';

// Mocked: tabs APIs are stubbed on WXT's fake browser. Real-browser coverage of the active
// and unsupported states lives in tests/e2e.
describe('getTabStatus (mocked tabs API)', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  function stubTab(url: string | undefined, ping: () => Promise<unknown>) {
    vi.spyOn(fakeBrowser.tabs, 'get').mockResolvedValue({ id: 7, url } as never);
    // sendMessage's callback overload makes the rule think a promise is misused here.
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    return vi.spyOn(fakeBrowser.tabs, 'sendMessage').mockImplementation(ping);
  }

  it('is active when the content script answers the ping', async () => {
    stubTab('https://example.com', () =>
      Promise.resolve({ ok: true, ready: true, menuOpen: false }),
    );
    expect(await getTabStatus(7)).toEqual({ state: 'active' });
  });

  it('asks for a reload when a web page has no content script yet', async () => {
    stubTab('https://example.com', () => Promise.reject(new Error('Receiving end does not exist')));
    expect(await getTabStatus(7)).toEqual({ state: 'needs-reload' });
  });

  it('treats malformed ping responses as no content script', async () => {
    stubTab('https://example.com', () => Promise.resolve({ hello: 'page' }));
    expect(await getTabStatus(7)).toEqual({ state: 'needs-reload' });
  });

  it('reports browser pages as unsupported without pinging', async () => {
    const send = stubTab('chrome://settings', () => Promise.resolve());
    expect(await getTabStatus(7)).toMatchObject({ state: 'unsupported' });
    expect(send).not.toHaveBeenCalled();
  });

  it('reports pages with hidden URLs as unsupported when the ping fails', async () => {
    stubTab(undefined, () => Promise.reject(new Error('no receiver')));
    expect(await getTabStatus(7)).toMatchObject({ state: 'unsupported' });
  });

  it('handles a tab that no longer exists', async () => {
    vi.spyOn(fakeBrowser.tabs, 'get').mockRejectedValue(new Error('No tab with id'));
    expect(await getTabStatus(99)).toMatchObject({ state: 'unsupported' });
  });
});
