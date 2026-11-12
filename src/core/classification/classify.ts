import type { ElementClassification, ElementKind, PageClassification } from '../contracts';
import { UNCLASSIFIED_PAGE } from '../contracts';

const SENSITIVE_INPUT_TYPES = new Set([
  'password',
  'email',
  'tel',
  'number',
  'credit-card',
  'cc-number',
  'cc-csc',
  'cc-exp',
]);

const SENSITIVE_AUTOCOMPLETE =
  /^(cc-|card-|password|one-time-code|otp|current-password|new-password)/i;

/**
 * Local page classification. Must stay network-free and cheap enough for post-menu work
 * (< 200 ms). Never used to change which actions are pinned.
 */
export function classifyPage(doc: Document, url: string): PageClassification {
  const signals: string[] = [];
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return { ...UNCLASSIFIED_PAGE, signals: ['invalid-url'] };
  }

  const github = matchGithubIssue(parsedUrl, doc, signals);
  if (github) return github;

  const product = matchProduct(doc, signals);
  if (product) return product;

  const listing = matchListing(doc, signals);
  if (listing) return listing;

  const documentation = matchDocumentation(doc, parsedUrl, signals);
  if (documentation) return documentation;

  if (doc.querySelector('article') || hasArticleSchema(doc)) {
    signals.push(doc.querySelector('article') ? '<article> element' : 'schema.org/Article');
    return { kind: 'article', confidence: 0.75, signals };
  }

  const ogType = metaContent(doc, 'property', 'og:type');
  if (ogType === 'article') {
    signals.push('og:type=article');
    return { kind: 'article', confidence: 0.7, signals };
  }

  return {
    kind: 'generic',
    confidence: 0.2,
    signals: signals.length ? signals : ['no strong signals'],
  };
}

export function classifyElement(el: Element): ElementClassification {
  const sensitive = isSensitiveElement(el);
  const kind = detectElementKind(el);
  const signals = elementSignals(el, kind);
  const confidence = kind === 'unknown' ? 0.2 : kind === 'paragraph' ? 0.7 : 0.85;
  return { kind, confidence, signals, sensitive };
}

export function isExcludedChrome(el: Element): boolean {
  if (el.closest('nav, aside, [role="navigation"], [role="complementary"]')) return true;
  if (el.closest('[role="banner"], header[role="banner"]')) return true;
  if (el.closest('.ad, .ads, .advertisement, [data-ad], [aria-label="advertisement" i]')) {
    return true;
  }
  const className = typeof el.className === 'string' ? el.className.toLowerCase() : '';
  if (/\b(ad|ads|advert|sponsor|sidebar|cookie-banner)\b/.test(className)) return true;
  return false;
}

function detectElementKind(el: Element): ElementKind {
  const tag = el.tagName.toLowerCase();
  if (tag === 'img' || el.closest('picture')) return 'image';
  if (tag === 'a' && el.hasAttribute('href')) return 'link';
  if (tag === 'table' || (tag === 'td' && el.closest('table'))) return 'table';
  if (tag === 'ul' || tag === 'ol' || tag === 'li') return 'list';
  if (tag === 'pre' || tag === 'code') return 'code';
  if (tag === 'blockquote') return 'quote';
  if (/^h[1-6]$/.test(tag)) return 'heading';
  if (tag === 'article') return 'article';
  if (tag === 'section') return 'section';
  if (
    tag === 'input' ||
    tag === 'textarea' ||
    tag === 'select' ||
    (el as HTMLElement).isContentEditable
  ) {
    return 'form-field';
  }
  if (tag === 'p') return 'paragraph';
  if (tag === 'div' || tag === 'span') {
    const text = el.textContent.trim();
    if (text.length > 40 && !el.querySelector('p, h1, h2, h3, ul, ol, table')) return 'paragraph';
  }
  return 'unknown';
}

function elementSignals(el: Element, kind: ElementKind): string[] {
  const signals = [`<${el.tagName.toLowerCase()}>`];
  if (kind !== 'unknown') signals.push(`kind:${kind}`);
  if (el.id) signals.push(`#${el.id}`);
  return signals.slice(0, 32);
}

export function isSensitiveElement(el: Element): boolean {
  const field =
    el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement
      ? el
      : el.closest('input, textarea');
  if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement)) return false;
  if (field instanceof HTMLInputElement) {
    const type = (field.type || 'text').toLowerCase();
    if (SENSITIVE_INPUT_TYPES.has(type)) return true;
    if (field.name && /password|card|cvv|ssn|otp/i.test(field.name)) return true;
  }
  const autocomplete = field.getAttribute('autocomplete') ?? '';
  if (SENSITIVE_AUTOCOMPLETE.test(autocomplete)) return true;
  return false;
}

function matchGithubIssue(url: URL, doc: Document, signals: string[]): PageClassification | null {
  if (!/(^|\.)github\.com$/i.test(url.hostname)) return null;
  const match = /^\/([\w.-]+\/[\w.-]+)\/(issues|pull)\/(\d+)/.exec(url.pathname);
  if (!match) return null;
  const repository = match[1];
  const kind = match[2];
  const numberText = match[3];
  if (!repository || !kind || !numberText) return null;
  const isPullRequest = kind === 'pull';
  const issueNumber = Number(numberText);
  signals.push(`github:${isPullRequest ? 'pull' : 'issue'}`);
  if (doc.querySelector('.js-issue-title, [data-testid="issue-title"]')) {
    signals.push('github issue title');
  }
  return {
    kind: 'github-issue',
    confidence: 0.95,
    signals,
    repository,
    issueNumber,
    isPullRequest,
  };
}

function matchProduct(doc: Document, signals: string[]): PageClassification | null {
  const ogType = metaContent(doc, 'property', 'og:type');
  if (ogType === 'product' || ogType === 'og:product') {
    signals.push(`og:type=${ogType}`);
    return { kind: 'product', confidence: 0.85, signals, availability: 'unknown' };
  }
  if (hasSchemaType(doc, 'Product')) {
    signals.push('schema.org/Product');
    return { kind: 'product', confidence: 0.9, signals, availability: 'unknown' };
  }
  return null;
}

function matchListing(doc: Document, signals: string[]): PageClassification | null {
  if (hasSchemaType(doc, 'JobPosting')) {
    signals.push('schema.org/JobPosting');
    return { kind: 'listing', confidence: 0.9, signals, listingType: 'job' };
  }
  if (hasSchemaType(doc, 'Residence') || hasSchemaType(doc, 'Apartment')) {
    signals.push('schema.org/Residence');
    return { kind: 'listing', confidence: 0.85, signals, listingType: 'apartment' };
  }
  const cards = doc.querySelectorAll('[itemtype*="Product"], .product-card, .listing-card');
  if (cards.length >= 3) {
    signals.push(`repeated cards:${cards.length}`);
    return {
      kind: 'listing',
      confidence: 0.7,
      signals,
      listingType: 'product',
      itemCount: cards.length,
    };
  }
  return null;
}

function matchDocumentation(doc: Document, url: URL, signals: string[]): PageClassification | null {
  if (/docs\.|developer\.|readthedocs|gitbook/i.test(url.hostname + url.pathname)) {
    signals.push('docs host/path');
    return { kind: 'documentation', confidence: 0.8, signals };
  }
  if (doc.querySelector('nav.toc, [role="doc-toc"], .documentation, .md-content')) {
    signals.push('docs chrome');
    return { kind: 'documentation', confidence: 0.75, signals };
  }
  return null;
}

function hasArticleSchema(doc: Document): boolean {
  return (
    hasSchemaType(doc, 'Article') ||
    hasSchemaType(doc, 'NewsArticle') ||
    hasSchemaType(doc, 'BlogPosting')
  );
}

function hasSchemaType(doc: Document, type: string): boolean {
  for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
    const text = script.textContent;
    if (text.includes(`"${type}"`) || text.includes(`/${type}"`)) return true;
  }
  return Boolean(doc.querySelector(`[itemtype*="${type}"]`));
}

function metaContent(doc: Document, attr: string, value: string): string | null {
  const el = doc.querySelector(`meta[${attr}="${value}"]`);
  return el?.getAttribute('content') ?? null;
}
