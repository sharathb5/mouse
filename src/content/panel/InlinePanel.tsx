import { useEffect, useRef, useState, type KeyboardEvent, type SyntheticEvent } from 'react';
import { computeMenuPosition, getViewportSize, type Point } from '../positioning';
import type { PanelState } from './state';

export interface InlinePanelProps {
  state: PanelState;
  anchor: Point;
  onClose: () => void;
  onFollowUp?: ((question: string) => void) | undefined;
}

export function InlinePanel({ state, anchor, onClose, onFollowUp }: InlinePanelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<Point | null>(null);
  const [question, setQuestion] = useState('');
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPosition(
      computeMenuPosition(
        anchor,
        { width: rect.width, height: rect.height },
        getViewportSize(),
        12,
      ),
    );
  }, [anchor, state.text, state.error]);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight });
  }, [state.text]);

  const submitFollowUp = (event: SyntheticEvent) => {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || !onFollowUp) return;
    onFollowUp(trimmed);
    setQuestion('');
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  };

  const isMock = state.providerLabel?.toLowerCase().includes('mock');

  return (
    <div
      ref={ref}
      className="am-panel"
      role="dialog"
      aria-label={state.title || 'Agentic Mouse response'}
      data-testid="agentic-mouse-panel"
      data-status={state.status}
      style={{
        left: position?.x ?? 0,
        top: position?.y ?? 0,
        visibility: position ? 'visible' : 'hidden',
      }}
      onKeyDown={onKeyDown}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="am-panel-header">
        <div>
          <div className="am-panel-title">
            {state.title}
            {isMock && (
              <span className="am-panel-badge" data-testid="agentic-mouse-mock-badge">
                Mock
              </span>
            )}
          </div>
          {state.providerLabel && <div className="am-panel-meta">{state.providerLabel}</div>}
        </div>
        <button
          type="button"
          className="am-panel-close"
          aria-label="Close"
          data-testid="agentic-mouse-panel-close"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      {state.error ? (
        <div className="am-panel-error" role="alert" data-testid="agentic-mouse-panel-error">
          {state.error}
        </div>
      ) : (
        <div
          ref={bodyRef}
          className="am-panel-body"
          data-status={state.status}
          data-testid="agentic-mouse-panel-body"
        >
          {state.text || (state.status === 'streaming' ? '' : '…')}
        </div>
      )}
      {onFollowUp && state.status === 'complete' && (
        <form className="am-panel-footer" onSubmit={submitFollowUp}>
          <input
            type="text"
            value={question}
            placeholder="Ask a follow-up…"
            aria-label="Ask a follow-up"
            data-testid="agentic-mouse-follow-up"
            onChange={(event) => setQuestion(event.target.value)}
          />
          <button type="submit" disabled={!question.trim()}>
            Ask
          </button>
        </form>
      )}
    </div>
  );
}
