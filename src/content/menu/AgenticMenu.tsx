import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { ResolvedAction } from '@/core/actions';
import type { ActionCategory } from '@/core/contracts';
import { describeQuickTargetKind, type MenuInvocation } from '../invocation';
import { computeMenuPosition, getViewportSize, type Point } from '../positioning';

export interface AgenticMenuProps {
  invocation: MenuInvocation;
  entries: ResolvedAction[];
  onSelect: (entry: ResolvedAction) => void;
  onDismiss: () => void;
  onPositioned: (element: HTMLElement) => void;
}

export function AgenticMenu({
  invocation,
  entries,
  onSelect,
  onDismiss,
  onPositioned,
}: AgenticMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<Point | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Measure before paint so the menu never flashes outside the viewport.
  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const rect = menu.getBoundingClientRect();
    setPosition(
      computeMenuPosition(
        invocation.anchor,
        { width: rect.width, height: rect.height },
        getViewportSize(),
      ),
    );
  }, [invocation.anchor]);

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!position || !menu) return;
    onPositioned(menu);
    menu.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true });
    // onPositioned is intentionally excluded: it should fire once per placement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = [...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    if (items.length === 0) return;
    // document.activeElement is the shadow host, so ask each item directly.
    const index = items.findIndex((item) => item.matches(':focus'));
    let next: number | null = null;
    if (event.key === 'ArrowDown') next = (index + 1) % items.length;
    else if (event.key === 'ArrowUp') next = (index - 1 + items.length) % items.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = items.length - 1;
    else if (event.key === 'Tab') {
      event.preventDefault();
      onDismiss();
      return;
    }
    if (next !== null) {
      event.preventDefault();
      items[next]?.focus({ preventScroll: true });
    }
  };

  const handleSelect = (entry: ResolvedAction) => {
    if (entry.availability.status !== 'available') {
      setNotice(`${entry.definition.label} isn't available yet. It's coming in a future update.`);
      return;
    }
    onSelect(entry);
  };

  return (
    <div
      ref={menuRef}
      className="am-menu"
      role="menu"
      aria-label="Agentic Mouse"
      data-testid="agentic-mouse-menu"
      data-source={invocation.source}
      style={{
        left: position?.x ?? 0,
        top: position?.y ?? 0,
        visibility: position ? 'visible' : 'hidden',
      }}
      onKeyDown={handleKeyDown}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="am-header">
        <span className="am-brand">
          <CursorGlyph />
          Agentic Mouse
        </span>
        <span className="am-target" data-testid="agentic-mouse-target">
          {describeQuickTargetKind(invocation.quickKind)}
        </span>
      </div>
      {entries.length === 0 ? (
        <p className="am-empty">No pinned actions. Add some from the toolbar popup.</p>
      ) : (
        <ul className="am-list" role="none">
          {entries.map((entry) => {
            const unavailable = entry.availability.status !== 'available';
            return (
              <li key={entry.definition.id} role="none">
                <button
                  type="button"
                  role="menuitem"
                  className="am-item"
                  data-action-id={entry.definition.id}
                  data-availability={entry.availability.status}
                  aria-disabled={unavailable || undefined}
                  title={
                    entry.availability.status === 'available'
                      ? entry.definition.description
                      : entry.availability.reason
                  }
                  onClick={() => handleSelect(entry)}
                >
                  <span className="am-icon" aria-hidden="true">
                    <CategoryIcon category={entry.definition.category} />
                  </span>
                  <span className="am-label">{entry.definition.label}</span>
                  {unavailable && <span className="am-badge">Soon</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div
        className="am-status"
        role="status"
        aria-live="polite"
        data-testid="agentic-mouse-status"
      >
        {notice}
      </div>
    </div>
  );
}

function CursorGlyph() {
  return (
    <svg className="am-glyph" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path d="M3 1.5v11.2l3-2.9 2 4.7 2-.9-2-4.6h4.2z" fill="currentColor" />
    </svg>
  );
}

function CategoryIcon({ category }: { category: ActionCategory }) {
  switch (category) {
    case 'understand':
      return (
        <svg viewBox="0 0 16 16" width="16" height="16">
          <path
            d="M8 1.5a4.5 4.5 0 0 0-2.6 8.2V11h5.2V9.7A4.5 4.5 0 0 0 8 1.5zM6 12.5h4M6.7 14.5h2.6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'select':
      return (
        <svg viewBox="0 0 16 16" width="16" height="16">
          <rect
            x="2"
            y="2"
            width="12"
            height="12"
            rx="2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeDasharray="2.2 1.8"
          />
          <path
            d="M5 6h6M5 8.5h6M5 11h3.5"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'delegate':
      return (
        <svg viewBox="0 0 16 16" width="16" height="16">
          <path
            d="M2 8h9M8 4.5 11.5 8 8 11.5M13.5 3v10"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case 'real-world':
      return (
        <svg viewBox="0 0 16 16" width="16" height="16">
          <path
            d="M2.5 13.5V8M6.2 13.5V4.5M9.8 13.5v-6M13.5 13.5V2.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </svg>
      );
  }
}
