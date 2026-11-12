export type PageSupport =
  | { supported: true }
  | {
      supported: false;
      reason: 'browser-page' | 'web-store' | 'extension-page' | 'non-web-page' | 'unknown';
    };

const WEB_STORE_HOSTS = new Set(['chromewebstore.google.com', 'chrome.google.com']);

/**
 * Whether Chrome allows the content script to run on a URL. Mirrors the manifest match
 * patterns (http/https only) plus Chrome's protected hosts.
 */
export function classifyPageSupport(url: string | undefined): PageSupport {
  if (!url) return { supported: false, reason: 'unknown' };
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { supported: false, reason: 'unknown' };
  }

  switch (parsed.protocol) {
    case 'http:':
    case 'https:':
      if (
        WEB_STORE_HOSTS.has(parsed.hostname) &&
        (parsed.hostname !== 'chrome.google.com' || parsed.pathname.startsWith('/webstore'))
      ) {
        return { supported: false, reason: 'web-store' };
      }
      return { supported: true };
    case 'chrome:':
    case 'about:':
    case 'edge:':
    case 'devtools:':
    case 'view-source:':
      return { supported: false, reason: 'browser-page' };
    case 'chrome-extension:':
      return { supported: false, reason: 'extension-page' };
    default:
      return { supported: false, reason: 'non-web-page' };
  }
}

export function describeUnsupportedReason(
  reason: Extract<PageSupport, { supported: false }>['reason'],
): string {
  switch (reason) {
    case 'browser-page':
      return 'Chrome does not allow extensions on its own pages.';
    case 'web-store':
      return 'Chrome does not allow extensions on the Chrome Web Store.';
    case 'extension-page':
      return 'Extension pages are protected by Chrome.';
    case 'non-web-page':
      return 'Agentic Mouse runs on regular web pages (http and https).';
    case 'unknown':
      return 'Agentic Mouse cannot access this page.';
  }
}
