import {
  ACTION_CATALOG,
  addPinnedAction,
  canPinMore,
  movePinnedAction,
  removePinnedAction,
  resetPinnedActions,
  unpinnedActions,
} from '@/core/actions';
import { createConsumerActionRegistry } from '@/actions/register-consumer';
import { MAX_PINNED_ACTIONS, type ActionId } from '@/core/contracts';

// Same executors as the content script so "Soon" badges match real availability.
const registry = createConsumerActionRegistry();

export function PinnedActionsPanel({
  pinned,
  onChange,
}: {
  pinned: ActionId[];
  onChange: (pinned: ActionId[]) => void;
}) {
  const available = unpinnedActions(pinned);
  const canAdd = canPinMore(pinned);

  return (
    <div className="pinned">
      <p className="hint">
        These actions appear, in this order, when you open Agentic Mouse. Page type never changes
        this list.
      </p>
      {pinned.length === 0 ? (
        <p className="empty">No pinned actions.</p>
      ) : (
        <ol className="pinned-list" data-testid="pinned-list">
          {pinned.map((id, index) => {
            const { label } = ACTION_CATALOG[id];
            return (
              <li key={id} className="pinned-row" data-action-id={id}>
                <span className="pinned-index">{index + 1}</span>
                <span className="pinned-label">{label}</span>
                {registry.get(id).availability.status !== 'available' && (
                  <span className="soon">Soon</span>
                )}
                <span className="row-actions">
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Move ${label} up`}
                    disabled={index === 0}
                    onClick={() => onChange(movePinnedAction(pinned, id, -1))}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Move ${label} down`}
                    disabled={index === pinned.length - 1}
                    onClick={() => onChange(movePinnedAction(pinned, id, 1))}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Remove ${label}`}
                    onClick={() => onChange(removePinnedAction(pinned, id))}
                  >
                    ×
                  </button>
                </span>
              </li>
            );
          })}
        </ol>
      )}

      <h2 className="section-title">Add from library</h2>
      {!canAdd && <p className="hint">You can pin up to {MAX_PINNED_ACTIONS} actions.</p>}
      <div className="chips" data-testid="action-library">
        {available.map((id) => (
          <button
            key={id}
            type="button"
            className="chip"
            disabled={!canAdd}
            aria-label={`Add ${ACTION_CATALOG[id].label}`}
            onClick={() => onChange(addPinnedAction(pinned, id))}
          >
            + {ACTION_CATALOG[id].label}
          </button>
        ))}
      </div>

      <button type="button" className="link-btn" onClick={() => onChange(resetPinnedActions())}>
        Reset to defaults
      </button>
      <p className="footnote">
        Actions marked “Soon” are placeholders and do not run yet. Extract, Compare, and Track run
        locally from the page menu.
      </p>
    </div>
  );
}
