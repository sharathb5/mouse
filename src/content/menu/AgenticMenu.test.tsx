import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createActionRegistry, type ActionExecutor } from '@/core/actions';
import type { MenuInvocation } from '../invocation';
import { AgenticMenu } from './AgenticMenu';

afterEach(cleanup);

const invocation: MenuInvocation = {
  id: 1,
  source: 'pointer',
  anchor: { x: 40, y: 40 },
  target: null,
  quickKind: 'element',
  startedAt: 0,
};

function renderMenu(
  entries = createActionRegistry().resolve(['explain', 'select-content', 'send-to-agent']),
) {
  const props = {
    invocation,
    entries,
    onSelect: vi.fn(),
    onDismiss: vi.fn(),
    onPositioned: vi.fn(),
  };
  render(<AgenticMenu {...props} />);
  return props;
}

describe('AgenticMenu', () => {
  it('renders pinned actions in order, marked as coming soon', () => {
    const props = renderMenu();
    const items = screen.getAllByRole('menuitem');
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
    const [first] = screen.getAllByRole('menuitem');
    if (!first) throw new Error('missing item');
    fireEvent.click(first);
    expect(props.onSelect).not.toHaveBeenCalled();
    expect(screen.getByRole('status').textContent).toMatch(/Explain This isn't available yet/);
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
    const [item] = screen.getAllByRole('menuitem');
    if (!item) throw new Error('missing item');
    expect(item.getAttribute('aria-disabled')).toBeNull();
    fireEvent.click(item);
    expect(props.onSelect).toHaveBeenCalledTimes(1);
  });

  it('supports arrow-key navigation and dismisses on Tab', () => {
    const props = renderMenu();
    const items = screen.getAllByRole('menuitem');
    const menu = screen.getByRole('menu');
    expect(items[0]).toBe(document.activeElement);
    act(() => {
      fireEvent.keyDown(menu, { key: 'ArrowDown' });
    });
    expect(items[1]).toBe(document.activeElement);
    act(() => {
      fireEvent.keyDown(menu, { key: 'ArrowUp' });
      fireEvent.keyDown(menu, { key: 'ArrowUp' });
    });
    expect(items[2]).toBe(document.activeElement);
    fireEvent.keyDown(menu, { key: 'Tab' });
    expect(props.onDismiss).toHaveBeenCalledTimes(1);
  });

  it('shows guidance when nothing is pinned', () => {
    renderMenu([]);
    expect(screen.getByText(/No pinned actions/)).toBeTruthy();
  });
});
