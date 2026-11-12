import { describe, expect, it } from 'vitest';
import { computeMenuPosition, VIEWPORT_MARGIN_PX } from './positioning';

const menu = { width: 232, height: 160 };
const viewport = { width: 1280, height: 720 };

describe('computeMenuPosition', () => {
  it('places the menu at the pointer when it fits', () => {
    expect(computeMenuPosition({ x: 100, y: 100 }, menu, viewport)).toEqual({ x: 100, y: 100 });
  });

  it('flips left and up near the bottom-right corner', () => {
    expect(computeMenuPosition({ x: 1270, y: 710 }, menu, viewport)).toEqual({
      x: 1270 - menu.width,
      y: 710 - menu.height,
    });
  });

  it('clamps to the margin when flipping would overflow the other edge', () => {
    const tall = { width: 232, height: 600 };
    expect(computeMenuPosition({ x: 10, y: 400 }, tall, viewport).y).toBe(VIEWPORT_MARGIN_PX);
  });

  it('pins to the margin when the menu is larger than the viewport', () => {
    expect(computeMenuPosition({ x: 50, y: 50 }, menu, { width: 200, height: 100 })).toEqual({
      x: VIEWPORT_MARGIN_PX,
      y: VIEWPORT_MARGIN_PX,
    });
  });

  it('always stays inside the viewport for any pointer position', () => {
    for (let x = -20; x <= viewport.width + 20; x += 37) {
      for (let y = -20; y <= viewport.height + 20; y += 29) {
        const pos = computeMenuPosition({ x, y }, menu, viewport);
        expect(pos.x).toBeGreaterThanOrEqual(VIEWPORT_MARGIN_PX);
        expect(pos.y).toBeGreaterThanOrEqual(VIEWPORT_MARGIN_PX);
        expect(pos.x + menu.width).toBeLessThanOrEqual(viewport.width - VIEWPORT_MARGIN_PX);
        expect(pos.y + menu.height).toBeLessThanOrEqual(viewport.height - VIEWPORT_MARGIN_PX);
      }
    }
  });
});
