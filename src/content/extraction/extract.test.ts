import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Window } from 'happy-dom';
import { describe, expect, it } from 'vitest';
import { SelectedContextSchema } from '@/core/contracts';
import { extractBlocks } from './blocks';
import { buildSelectedContext } from './context';

const fixture = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../core/classification/fixtures/article.html',
);

function loadArticle(): Document {
  const window = new Window({ url: 'https://example.com/article' });
  window.document.write(readFileSync(fixture, 'utf8'));
  return window.document as unknown as Document;
}

describe('extractBlocks', () => {
  it('preserves headings, paragraphs, tables, and code while skipping ads', () => {
    const doc = loadArticle();
    const article = doc.querySelector('article');
    expect(article).toBeTruthy();
    if (!article) throw new Error('missing article');
    const blocks = extractBlocks(article);
    expect(blocks.some((b) => b.type === 'heading')).toBe(true);
    expect(blocks.some((b) => b.type === 'paragraph')).toBe(true);
    expect(blocks.some((b) => b.type === 'table')).toBe(true);
    expect(blocks.some((b) => b.type === 'code' && b.language === 'ts')).toBe(true);
    expect(blocks.map((b) => ('text' in b ? b.text : '')).join(' ')).not.toMatch(/Advertisement/);
  });
});

describe('buildSelectedContext', () => {
  it('validates against SelectedContextSchema and sets sensitive when needed', () => {
    const doc = loadArticle();
    const intro = doc.querySelector('#intro');
    expect(intro).toBeTruthy();
    if (!intro) throw new Error('missing #intro');
    const context = buildSelectedContext({
      element: intro,
      url: 'https://example.com/article',
      title: 'How Agents Read the Web',
      now: new Date('2026-11-12T04:00:00.000Z'),
    });
    expect(SelectedContextSchema.parse(context).untrusted).toBe(true);
    expect(context.target.kind).toBe('element');
    expect(context.containsSensitiveData).toBe(false);
  });
});
