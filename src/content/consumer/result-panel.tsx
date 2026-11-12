import { useEffect, useId, useRef, useState } from 'react';
import type { ActionResult } from '@/core/contracts';
import { toCsv } from '@/core/normalize';

export interface ResultPanelProps {
  result: ActionResult;
  onDismiss: () => void;
}

export function ResultPanel({ result, onDismiss }: ResultPanelProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onDismiss();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onDismiss]);

  return (
    <section
      className="am-result"
      data-testid="agentic-mouse-result"
      data-result-kind={result.kind}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
    >
      <header className="am-result__header">
        <h2 id={titleId}>{titleFor(result)}</h2>
        <button
          ref={closeRef}
          type="button"
          className="am-result__close"
          data-testid="result-dismiss"
          aria-label="Dismiss result"
          onClick={onDismiss}
        >
          ×
        </button>
      </header>
      <div className="am-result__body">{renderBody(result, copyState, setCopyState)}</div>
    </section>
  );
}

function titleFor(result: ActionResult): string {
  switch (result.kind) {
    case 'table':
      return 'Extract';
    case 'comparison':
      return 'Compare';
    case 'tracking':
      return 'Tracking';
    case 'unavailable':
      return 'Unavailable';
    case 'inline-text':
    case 'selection':
    case 'handoff':
      return 'Result';
  }
}

function renderBody(
  result: ActionResult,
  copyState: 'idle' | 'copied' | 'error',
  setCopyState: (state: 'idle' | 'copied' | 'error') => void,
) {
  switch (result.kind) {
    case 'table': {
      const csv = toCsv(result);
      return (
        <>
          <div className="am-result__actions">
            <button
              type="button"
              data-testid="extract-copy"
              onClick={() => {
                void navigator.clipboard.writeText(csv).then(
                  () => setCopyState('copied'),
                  () => setCopyState('error'),
                );
              }}
            >
              {copyState === 'copied'
                ? 'Copied'
                : copyState === 'error'
                  ? 'Copy failed'
                  : 'Copy CSV'}
            </button>
            <button type="button" data-testid="extract-download" onClick={() => downloadCsv(csv)}>
              Download CSV
            </button>
          </div>
          <div className="am-result__table-wrap">
            <table data-testid="extract-table">
              <thead>
                <tr>
                  {result.columns.map((column) => (
                    <th key={column.key}>{column.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row, index) => (
                  <tr key={index}>
                    {result.columns.map((column) => (
                      <td key={column.key}>{formatCell(row[column.key] ?? null)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <SourceList sources={result.sources} />
        </>
      );
    }
    case 'comparison':
      return (
        <>
          <p className="am-result__summary" data-testid="compare-summary">
            {result.summary}
          </p>
          <div className="am-result__table-wrap">
            <table data-testid="compare-table">
              <thead>
                <tr>
                  <th>Item</th>
                  {result.attributes.map((column) => (
                    <th key={column.key}>{column.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.items.map((item) => (
                  <tr key={item.url}>
                    <td>
                      <a href={item.url} target="_blank" rel="noreferrer">
                        {item.name}
                      </a>
                    </td>
                    {result.attributes.map((column) => (
                      <td key={column.key}>{formatCell(item.values[column.key] ?? null)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <SourceList sources={result.sources} />
        </>
      );
    case 'tracking':
      return (
        <div data-testid="tracking-result">
          <p>
            Watching with condition <code>{result.condition.kind}</code>.
          </p>
          <p>
            Tracker <code data-testid="tracker-id">{result.trackerId}</code>
          </p>
          <p>
            Next check at{' '}
            <time data-testid="tracker-next-check" dateTime={result.nextCheckAt}>
              {result.nextCheckAt}
            </time>
          </p>
        </div>
      );
    case 'unavailable':
      return (
        <p data-testid="result-unavailable">
          {result.actionId}: {result.reason}
        </p>
      );
    case 'inline-text':
      return <pre>{result.text}</pre>;
    case 'selection':
    case 'handoff':
      return <p data-testid="result-generic">{result.kind}</p>;
  }
}

function SourceList({ sources }: { sources: string[] }) {
  if (sources.length === 0) return null;
  return (
    <ul className="am-result__sources" data-testid="result-sources">
      {sources.map((source) => (
        <li key={source}>
          <a href={source} target="_blank" rel="noreferrer">
            {source}
          </a>
        </li>
      ))}
    </ul>
  );
}

function formatCell(value: string | number | boolean | null): string {
  if (value === null) return '—';
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  return String(value);
}

function downloadCsv(csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'agentic-mouse-extract.csv';
  anchor.rel = 'noopener';
  anchor.click();
  URL.revokeObjectURL(url);
}
