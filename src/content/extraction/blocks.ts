import type { ContentBlock } from '@/core/contracts';
import { blocksToPlainText } from '@/core/context-text';
import { isExcludedChrome } from '@/core/classification';

export { blocksToPlainText };

/**
 * Walk a DOM subtree into structure-preserving ContentBlocks. Skips nav/aside/ads.
 * Page content is untrusted; callers must treat the result as data.
 */
export function extractBlocks(root: Element): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  walk(root, blocks);
  return blocks;
}

function walk(node: Element, blocks: ContentBlock[]): void {
  if (isExcludedChrome(node) && node !== node.ownerDocument.documentElement) {
    if (node.matches('nav, aside, .ad, .ads, .advertisement')) return;
  }

  const tag = node.tagName.toLowerCase();

  if (/^h[1-6]$/.test(tag)) {
    const level = Number(tag.slice(1));
    blocks.push({
      type: 'heading',
      level: Math.min(6, Math.max(1, level)),
      text: textOf(node),
    });
    return;
  }

  if (tag === 'p') {
    const text = textOf(node);
    if (text) blocks.push({ type: 'paragraph', text });
    return;
  }

  if (tag === 'ul' || tag === 'ol') {
    const items = [...node.querySelectorAll(':scope > li')].map((li) => textOf(li)).filter(Boolean);
    if (items.length) blocks.push({ type: 'list', ordered: tag === 'ol', items });
    return;
  }

  if (tag === 'table') {
    const table = extractTable(node);
    if (table) blocks.push(table);
    return;
  }

  if (tag === 'pre') {
    const code = node.querySelector('code');
    const text = textOf(code ?? node);
    if (text) {
      const languageMatch = /language-([\w-]+)/.exec(code?.className ?? '');
      const language = languageMatch?.[1];
      blocks.push(language ? { type: 'code', language, text } : { type: 'code', text });
    }
    return;
  }

  if (tag === 'blockquote') {
    const text = textOf(node);
    if (text) blocks.push({ type: 'quote', text });
    return;
  }

  if (tag === 'img' && node instanceof HTMLImageElement && node.src) {
    try {
      blocks.push({
        type: 'image',
        src: new URL(node.src, node.baseURI).href,
        alt: node.alt || '',
      });
    } catch {
      /* ignore invalid src */
    }
    return;
  }

  if (tag === 'a' && node instanceof HTMLAnchorElement && node.href) {
    const text = textOf(node);
    if (text) {
      try {
        blocks.push({ type: 'link', href: new URL(node.href, node.baseURI).href, text });
      } catch {
        /* ignore */
      }
    }
    return;
  }

  for (const child of node.children) {
    if (child.matches('nav, aside, .ad, .ads, .advertisement, [role="navigation"]')) continue;
    walk(child, blocks);
  }

  if (
    blocks.length === 0 &&
    (tag === 'div' || tag === 'span' || tag === 'article' || tag === 'section')
  ) {
    const text = textOf(node);
    if (text && !node.querySelector('p, h1, h2, h3, ul, ol, table, pre')) {
      blocks.push({ type: 'paragraph', text });
    }
  }
}

function extractTable(table: Element): ContentBlock | null {
  const headers = [...table.querySelectorAll('thead th, tr:first-child th')].map((cell) =>
    textOf(cell),
  );
  const bodyRows = [...table.querySelectorAll('tbody tr')];
  const rowsSource =
    bodyRows.length > 0
      ? bodyRows
      : [...table.querySelectorAll('tr')].slice(headers.length ? 1 : 0);
  const rows = rowsSource.map((row) =>
    [...row.querySelectorAll('th, td')].map((cell) => textOf(cell)),
  );
  if (headers.length === 0 && rows.length === 0) return null;
  const caption = table.querySelector('caption');
  const firstRow = rows[0];
  const block: ContentBlock = {
    type: 'table',
    headers: headers.length ? headers : firstRow ? firstRow.map((_, i) => `Column ${i + 1}`) : [],
    rows: headers.length ? rows : rows.slice(1),
  };
  if (caption) {
    const text = textOf(caption);
    if (text) return { ...block, caption: text };
  }
  return block;
}

function textOf(el: Element): string {
  return el.textContent.replace(/\s+/g, ' ').trim();
}
