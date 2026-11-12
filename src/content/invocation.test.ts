import { afterEach, describe, expect, it } from 'vitest';
import { detectQuickTargetKind, shortcutAnchor } from './invocation';

afterEach(() => {
  document.body.innerHTML = '';
  window.getSelection()?.removeAllRanges();
});

describe('detectQuickTargetKind', () => {
  it('detects links, images, and generic content', () => {
    document.body.innerHTML = `
      <a href="https://example.com"><span id="in-link">link</span></a>
      <img id="img" alt="" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" />
      <p id="para">text</p>`;
    expect(detectQuickTargetKind(document.getElementById('in-link'), null)).toBe('link');
    expect(detectQuickTargetKind(document.getElementById('img'), null)).toBe('image');
    expect(detectQuickTargetKind(document.getElementById('para'), null)).toBe('element');
    expect(detectQuickTargetKind(null, null)).toBe('element');
  });

  it('prefers an active text selection', () => {
    document.body.innerHTML = '<p id="para">Selected words here</p>';
    const paragraph = document.getElementById('para');
    const selection = window.getSelection();
    if (!paragraph || !selection) throw new Error('fixture missing');
    selection.selectAllChildren(paragraph);
    expect(detectQuickTargetKind(paragraph, selection)).toBe('text-selection');
  });
});

describe('shortcutAnchor', () => {
  it('falls back to the viewport center without a selection', () => {
    expect(shortcutAnchor(null, { x: 1000, y: 600 })).toEqual({ x: 500, y: 300 });
  });
});
