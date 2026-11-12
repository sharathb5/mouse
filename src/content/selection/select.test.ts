import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Window } from 'happy-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { selectAt } from './select';

const fixture = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../core/classification/fixtures/article.html',
);

describe('selectAt', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('selects a paragraph and expands to section then article', () => {
    const window = new Window({ url: 'https://example.com/article' });
    window.document.write(readFileSync(fixture, 'utf8'));
    // happy-dom document into the vitest document
    document.documentElement.innerHTML = window.document.documentElement.innerHTML;

    const second = document.querySelector('#second');
    expect(second).toBeTruthy();
    const handle = selectAt({
      id: 1,
      source: 'pointer',
      anchor: { x: 10, y: 10 },
      target: second,
      quickKind: 'element',
      startedAt: 0,
    });
    expect(handle.kind).toBe('paragraph');
    expect(handle.element.id).toBe('second');

    const section = handle.expand();
    expect(section?.element.id).toBe('sec');
    const article = section?.expand();
    expect(article?.element.tagName.toLowerCase()).toBe('article');
    expect(article?.expand()).toBeNull();

    const shrunk = article?.shrink();
    expect(shrunk).toBeTruthy();
  });

  it('does not treat nav as the selection seed when clicking chrome', () => {
    const window = new Window({ url: 'https://example.com/article' });
    window.document.write(readFileSync(fixture, 'utf8'));
    document.documentElement.innerHTML = window.document.documentElement.innerHTML;
    const nav = document.querySelector('nav');
    const handle = selectAt({
      id: 1,
      source: 'pointer',
      anchor: { x: 10, y: 10 },
      target: nav,
      quickKind: 'element',
      startedAt: 0,
    });
    expect(handle.element.tagName.toLowerCase()).not.toBe('nav');
  });
});
