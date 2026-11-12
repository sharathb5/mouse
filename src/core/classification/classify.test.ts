import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Window } from 'happy-dom';
import { describe, expect, it } from 'vitest';
import { classifyElement, classifyPage, isExcludedChrome } from './classify';

const fixtures = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

function load(name: string, url: string): Document {
  const window = new Window({ url });
  window.document.write(readFileSync(join(fixtures, name), 'utf8'));
  return window.document as unknown as Document;
}

describe('classifyPage', () => {
  it('classifies article, product, and github-issue fixtures', () => {
    expect(
      classifyPage(load('article.html', 'https://example.com/a'), 'https://example.com/a').kind,
    ).toBe('article');
    expect(
      classifyPage(load('product.html', 'https://shop.example/mug'), 'https://shop.example/mug')
        .kind,
    ).toBe('product');
    expect(
      classifyPage(
        load('github-issue.html', 'https://github.com/sharathb5/mouse/issues/12'),
        'https://github.com/sharathb5/mouse/issues/12',
      ),
    ).toMatchObject({
      kind: 'github-issue',
      repository: 'sharathb5/mouse',
      issueNumber: 12,
      isPullRequest: false,
    });
  });
});

describe('classifyElement', () => {
  it('detects paragraphs and sensitive password fields', () => {
    const doc = load('article.html', 'https://example.com/a');
    const paragraph = doc.querySelector('#intro');
    expect(paragraph).toBeTruthy();
    if (!paragraph) throw new Error('missing #intro');
    expect(classifyElement(paragraph).kind).toBe('paragraph');

    const window = new Window({ url: 'https://example.com' });
    window.document.write('<input id="pw" type="password" />');
    const input = window.document.querySelector('#pw');
    expect(input).toBeTruthy();
    if (!input) throw new Error('missing #pw');
    expect(classifyElement(input as unknown as Element)).toMatchObject({
      kind: 'form-field',
      sensitive: true,
    });
  });

  it('marks nav and ads as excluded chrome', () => {
    const doc = load('article.html', 'https://example.com/a');
    const nav = doc.querySelector('nav');
    const ad = doc.querySelector('.ad');
    const intro = doc.querySelector('#intro');
    expect(nav && isExcludedChrome(nav)).toBe(true);
    expect(ad && isExcludedChrome(ad)).toBe(true);
    expect(intro && isExcludedChrome(intro)).toBe(false);
  });
});
