import { afterEach, describe, expect, it, vi } from 'vitest';
import { createActionRegistry, type ActionExecutor } from '@/core/actions';
import type { MenuInvocation } from '../invocation';
import { mountAgenticMenu, type AgenticMenuHandle } from './mount-menu';

const invocation: MenuInvocation = {
  id: 1,
  source: 'pointer',
  anchor: { x: 40, y: 40 },
  target: null,
  quickKind: 'element',
  startedAt: 0,
};

let handle: AgenticMenuHandle | null = null;
let root: HTMLElement;

afterEach(() => {
  handle?.destroy();
  handle = null;
  root.remove();
});

function renderMenu(
  entries = createActionRegistry().resolve(['explain', 'select-content', 'send-to-agent']),
) {
  root = document.createElement('div');
  document.body.append(root);
  const props = {
    invocation,
    entries,
    onSelect: vi.fn(),
    onDismiss: vi.fn(),
    onPositioned: vi.fn(),
  };
  handle = mountAgenticMenu(root, props);
  return props;
}

describe('AgenticMenu', () => {
  it('renders pinned actions in order, marked as coming soon', () => {
    const props = renderMenu();
    const items = [...root.querySelectorAll<HTMLElement>('[role="menuitem"]')];
    expect(items.map((item) => item.textContent)).toEqual([
      'Explain ThisSoon',
      'Select ContentSoon',
      'Send to AgentSoon',
    ]);
    for (const item of items) expect(item.getAttribute('aria-disabled')).toBe('true');
    expect(props.onPositioned).toHaveBeenCalledTimes(1);
  });

  it('explains instead of executing when an unavailable action is clicked', () => {
    const props = renderMenu();
    const first = root.querySelector<HTMLElement>('[role="menuitem"]');
    if (!first) throw new Error('missing item');
    first.click();
    expect(props.onSelect).not.toHaveBeenCalled();
    expect(root.querySelector('[role="status"]')?.textContent).toMatch(
      /Explain This isn't available yet/,
    );
  });

  it('forwards available actions to onSelect', () => {
    const executor: ActionExecutor<'explain'> = {
      actionId: 'explain',
      // eslint-disable-next-line require-yield
      async *execute() {
        await Promise.resolve();
      },
    };
    const props = renderMenu(createActionRegistry({ executors: [executor] }).resolve(['explain']));
    const item = root.querySelector<HTMLElement>('[role="menuitem"]');
    if (!item) throw new Error('missing item');
    expect(item.getAttribute('aria-disabled')).toBeNull();
    item.click();
    expect(props.onSelect).toHaveBeenCalledTimes(1);
  });

  it('supports arrow-key navigation and dismisses on Tab', () => {
    const props = renderMenu();
    const items = [...root.querySelectorAll<HTMLElement>('[role="menuitem"]')];
    const menu = root.querySelector<HTMLElement>('[role="menu"]');
    if (!menu) throw new Error('missing menu');
    expect(items[0]).toBe(document.activeElement);
    menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(items[1]).toBe(document.activeElement);
    menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(items[2]).toBe(document.activeElement);
    menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(props.onDismiss).toHaveBeenCalledTimes(1);
  });

  it('shows guidance when nothing is pinned', () => {
    renderMenu([]);
    expect(root.textContent).toMatch(/No pinned actions/);
  });
});
