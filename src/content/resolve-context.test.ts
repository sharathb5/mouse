import { describe, expect, it } from 'vitest';
import { resolveActionContext } from './resolve-context';
import type { MenuInvocation } from './invocation';
import type { SelectionHandle } from './selection';
import type { SelectedContext } from '@/core/contracts';

function invocation(target: Element | null): MenuInvocation {
  return {
    id: 1,
    source: 'pointer',
    anchor: { x: 10, y: 10 },
    target,
    startedAt: 0,
    quickKind: 'element',
  };
}

describe('resolveActionContext', () => {
  it('prefers an outlined selection handle when present', () => {
    document.body.innerHTML = '<article><p id="p">Hello outline</p></article>';
    const el = document.getElementById('p');
    if (!el) throw new Error('missing fixture');

    const context: SelectedContext = {
      untrusted: true,
      source: {
        url: 'https://example.com',
        title: 'T',
        capturedAt: '2026-11-12T04:00:00.000Z',
        frame: 'top',
      },
      target: {
        kind: 'element',
        element: { kind: 'paragraph', confidence: 1, signals: ['test'], sensitive: false },
        text: 'Hello outline',
        blocks: [{ type: 'paragraph', text: 'Hello outline' }],
      },
      page: { kind: 'article', confidence: 0.9, signals: [] },
      containsSensitiveData: false,
    };

    const handle: SelectionHandle = {
      element: el,
      kind: 'paragraph',
      expand: () => null,
      shrink: () => null,
      toContext: () => context,
    };

    expect(resolveActionContext({ invocation: invocation(el), selectionHandle: handle })).toBe(
      context,
    );
  });

  it('builds context from selectAt when no session exists', () => {
    document.body.innerHTML = '<main><p id="para">Semantic paragraph text</p></main>';
    const el = document.getElementById('para');
    if (!el) throw new Error('missing fixture');
    const resolved = resolveActionContext({ invocation: invocation(el) });
    expect(resolved.untrusted).toBe(true);
    expect(resolved.target.kind === 'element' || resolved.target.kind === 'text-selection').toBe(
      true,
    );
    if (resolved.target.kind === 'element') {
      expect(resolved.target.text).toContain('Semantic paragraph text');
    }
  });
});
