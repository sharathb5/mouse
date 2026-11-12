import { describe, expect, it } from 'vitest';
import { decideContextMenu } from './gesture';

describe('decideContextMenu', () => {
  const shiftMode = { enabled: true, triggerMode: 'shift-right-click' } as const;
  const reversed = { enabled: true, triggerMode: 'right-click' } as const;

  it('leaves plain right-click to Chrome by default', () => {
    expect(decideContextMenu({ shiftKey: false }, shiftMode)).toBe('native');
  });

  it('opens Agentic Mouse on Shift + right-click by default', () => {
    expect(decideContextMenu({ shiftKey: true }, shiftMode)).toBe('agentic-mouse');
  });

  it('swaps the gestures in reversed mode', () => {
    expect(decideContextMenu({ shiftKey: false }, reversed)).toBe('agentic-mouse');
    expect(decideContextMenu({ shiftKey: true }, reversed)).toBe('native');
  });

  it('never intercepts when disabled', () => {
    expect(decideContextMenu({ shiftKey: true }, { ...shiftMode, enabled: false })).toBe('native');
    expect(decideContextMenu({ shiftKey: false }, { ...reversed, enabled: false })).toBe('native');
  });

  it('fails open to the native menu before settings load', () => {
    expect(decideContextMenu({ shiftKey: true }, null)).toBe('native');
  });
});
