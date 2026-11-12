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

export interface AgenticMenuHandle {
  update(props: AgenticMenuProps): void;
  destroy(): void;
  readonly element: HTMLElement;
}

/**
 * Vanilla Shadow-DOM menu for the content-script hot path. Keeps React out of the
 * initial gesture/menu shell; React panels load lazily after an action is chosen.
 */
export function mountAgenticMenu(
  container: HTMLElement,
  initial: AgenticMenuProps,
): AgenticMenuHandle {
  let props = initial;
  let position: Point | null = null;
  let notice: string | null = null;
  let positionedFor: number | null = null;

  const menu = document.createElement('div');
  menu.className = 'am-menu';
  menu.role = 'menu';
  menu.setAttribute('aria-label', 'Agentic Mouse');
  menu.dataset.testid = 'agentic-mouse-menu';
  menu.addEventListener('contextmenu', (event) => event.preventDefault());
  menu.addEventListener('keydown', onKeyDown);

  const header = document.createElement('div');
  header.className = 'am-header';
  const brand = document.createElement('span');
  brand.className = 'am-brand';
  brand.append(createCursorGlyph(), document.createTextNode(' Agentic Mouse'));
  const target = document.createElement('span');
  target.className = 'am-target';
  target.dataset.testid = 'agentic-mouse-target';
  header.append(brand, target);

  const status = document.createElement('div');
  status.className = 'am-status';
  status.role = 'status';
  status.setAttribute('aria-live', 'polite');
  status.dataset.testid = 'agentic-mouse-status';

  container.replaceChildren(menu);

  function applyPosition() {
    menu.style.left = `${position?.x ?? 0}px`;
    menu.style.top = `${position?.y ?? 0}px`;
    menu.style.visibility = position ? 'visible' : 'hidden';
  }

  function paint() {
    menu.dataset.source = props.invocation.source;
    target.textContent = describeQuickTargetKind(props.invocation.quickKind);
    status.textContent = notice ?? '';

    const entryNodes: HTMLElement[] = [];
    if (props.entries.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'am-empty';
      empty.textContent = 'No pinned actions. Add some from the toolbar popup.';
      entryNodes.push(empty);
    } else {
      const list = document.createElement('ul');
      list.className = 'am-list';
      list.role = 'none';
      for (const entry of props.entries) {
        const unavailable = entry.availability.status !== 'available';
        const item = document.createElement('li');
        item.role = 'none';
        const button = document.createElement('button');
        button.type = 'button';
        button.role = 'menuitem';
        button.className = 'am-item';
        button.dataset.actionId = entry.definition.id;
        button.dataset.availability = entry.availability.status;
        if (unavailable) button.setAttribute('aria-disabled', 'true');
        button.title =
          entry.availability.status === 'available'
            ? entry.definition.description
            : entry.availability.reason;
        button.addEventListener('click', () => {
          if (entry.availability.status !== 'available') {
            notice = `${entry.definition.label} isn't available yet. It's coming in a future update.`;
            status.textContent = notice;
            return;
          }
          props.onSelect(entry);
        });

        const icon = document.createElement('span');
        icon.className = 'am-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.append(createCategoryIcon(entry.definition.category));

        const label = document.createElement('span');
        label.className = 'am-label';
        label.textContent = entry.definition.label;

        button.append(icon, label);
        if (unavailable) {
          const badge = document.createElement('span');
          badge.className = 'am-badge';
          badge.textContent = 'Soon';
          button.append(badge);
        }
        item.append(button);
        list.append(item);
      }
      entryNodes.push(list);
    }

    menu.replaceChildren(header, ...entryNodes, status);
    applyPosition();
  }

  function measureAndPlace() {
    const rect = menu.getBoundingClientRect();
    position = computeMenuPosition(
      props.invocation.anchor,
      { width: rect.width, height: rect.height },
      getViewportSize(),
    );
    applyPosition();
    if (positionedFor !== props.invocation.id) {
      positionedFor = props.invocation.id;
      props.onPositioned(menu);
      menu.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true });
    }
  }

  function onKeyDown(event: KeyboardEvent) {
    const items = [...menu.querySelectorAll<HTMLElement>('[role="menuitem"]')];
    if (items.length === 0) return;
    const index = items.findIndex((item) => item.matches(':focus'));
    let next: number | null = null;
    if (event.key === 'ArrowDown') next = (index + 1) % items.length;
    else if (event.key === 'ArrowUp') next = (index - 1 + items.length) % items.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = items.length - 1;
    else if (event.key === 'Tab') {
      event.preventDefault();
      props.onDismiss();
      return;
    }
    if (next !== null) {
      event.preventDefault();
      items[next]?.focus({ preventScroll: true });
    }
  }

  paint();
  // Measure after the browser has laid out the freshly mounted menu (sync, before paint when
  // called from the gesture path after DOM insertion).
  measureAndPlace();

  return {
    get element() {
      return menu;
    },
    update(next) {
      const invocationChanged = next.invocation.id !== props.invocation.id;
      props = next;
      if (invocationChanged) {
        notice = null;
        position = null;
        positionedFor = null;
      }
      paint();
      measureAndPlace();
    },
    destroy() {
      menu.removeEventListener('keydown', onKeyDown);
      container.replaceChildren();
    },
  };
}

function createCursorGlyph(): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'am-glyph');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('width', '14');
  svg.setAttribute('height', '14');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M3 1.5v11.2l3-2.9 2 4.7 2-.9-2-4.6h4.2z');
  path.setAttribute('fill', 'currentColor');
  svg.append(path);
  return svg;
}

function createCategoryIcon(category: ActionCategory): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  switch (category) {
    case 'understand': {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute(
        'd',
        'M8 1.5a4.5 4.5 0 0 0-2.6 8.2V11h5.2V9.7A4.5 4.5 0 0 0 8 1.5zM6 12.5h4M6.7 14.5h2.6',
      );
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', 'currentColor');
      path.setAttribute('stroke-width', '1.3');
      path.setAttribute('stroke-linecap', 'round');
      svg.append(path);
      break;
    }
    case 'select': {
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', '2');
      rect.setAttribute('y', '2');
      rect.setAttribute('width', '12');
      rect.setAttribute('height', '12');
      rect.setAttribute('rx', '2');
      rect.setAttribute('fill', 'none');
      rect.setAttribute('stroke', 'currentColor');
      rect.setAttribute('stroke-width', '1.3');
      rect.setAttribute('stroke-dasharray', '2.2 1.8');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M5 6h6M5 8.5h6M5 11h3.5');
      path.setAttribute('stroke', 'currentColor');
      path.setAttribute('stroke-width', '1.3');
      path.setAttribute('stroke-linecap', 'round');
      svg.append(rect, path);
      break;
    }
    case 'delegate': {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M2 8h9M8 4.5 11.5 8 8 11.5M13.5 3v10');
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', 'currentColor');
      path.setAttribute('stroke-width', '1.3');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
      svg.append(path);
      break;
    }
    case 'real-world': {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M2.5 13.5V8M6.2 13.5V4.5M9.8 13.5v-6M13.5 13.5V2.5');
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', 'currentColor');
      path.setAttribute('stroke-width', '1.3');
      path.setAttribute('stroke-linecap', 'round');
      svg.append(path);
      break;
    }
  }
  return svg;
}
