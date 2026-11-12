import type { CSSProperties } from 'react';
import type { TaskProgress, TaskState } from '@/core/contracts';

export interface WalkingCatProps {
  state: TaskState;
}

export function WalkingCat({ state }: WalkingCatProps) {
  if (state.status === 'monitoring') {
    return <CatFrame mode="sleeping" label="Monitoring" />;
  }
  if (state.status === 'queued') {
    return <CatFrame mode="indeterminate" label="Queued" fraction={0} />;
  }
  if (state.status === 'running') {
    return state.progress.mode === 'determinate' ? (
      <CatFrame
        mode="determinate"
        label={state.progress.label ?? 'Running'}
        fraction={state.progress.fraction}
      />
    ) : (
      <CatFrame mode="indeterminate" label={state.progress.label ?? 'Running'} />
    );
  }
  if (state.status === 'completed') {
    return <CatFrame mode="done" label="Done" fraction={1} />;
  }
  if (state.status === 'failed') {
    return <CatFrame mode="failed" label="Failed" fraction={1} />;
  }
  return <CatFrame mode="done" label="Cancelled" fraction={1} />;
}

function CatFrame({
  mode,
  label,
  fraction,
}: {
  mode: TaskProgress['mode'] | 'sleeping' | 'done' | 'failed';
  label: string;
  fraction?: number;
}) {
  const reducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const walkClass =
    mode === 'sleeping'
      ? 'cat-track cat-sleeping'
      : mode === 'indeterminate'
        ? reducedMotion
          ? 'cat-track'
          : 'cat-track cat-indeterminate'
        : 'cat-track';

  const left =
    mode === 'determinate' || mode === 'done' || mode === 'failed'
      ? `${Math.round((fraction ?? 0) * 100)}%`
      : mode === 'sleeping'
        ? '12%'
        : '0%';

  return (
    <div
      className={walkClass}
      data-testid="walking-cat"
      data-mode={mode}
      aria-label={label}
      style={
        mode === 'determinate' || mode === 'done' || mode === 'failed'
          ? ({ '--cat-progress': left } as CSSProperties)
          : undefined
      }
    >
      <div className="cat-line" />
      <div className="cat-sprite" style={{ left }}>
        {mode === 'sleeping' ? <SleepingCatSvg /> : <WalkingCatSvg />}
      </div>
    </div>
  );
}

function WalkingCatSvg() {
  return (
    <svg viewBox="0 0 40 24" width="40" height="24" aria-hidden="true">
      <ellipse cx="18" cy="14" rx="12" ry="7" fill="currentColor" />
      <circle cx="28" cy="10" r="5" fill="currentColor" />
      <path d="M24 6l2 4M32 6l-2 4" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <circle cx="30" cy="9" r="0.8" fill="#fff" />
      <path
        d="M8 18c2 3 6 3 8 0M14 18c2 3 6 3 8 0"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      <path d="M6 12c-3 1-4 4-3 6" stroke="currentColor" strokeWidth="1.5" fill="none" />
    </svg>
  );
}

function SleepingCatSvg() {
  return (
    <svg viewBox="0 0 48 28" width="48" height="28" aria-hidden="true">
      <ellipse cx="22" cy="18" rx="14" ry="7" fill="currentColor" fillOpacity="0.9" />
      <circle cx="34" cy="14" r="6" fill="currentColor" fillOpacity="0.9" />
      <path d="M8 16c-4 1-6 4-5 7" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <text x="40" y="8" fontSize="8" fill="currentColor" fillOpacity="0.55">
        z
      </text>
      <text x="44" y="3" fontSize="6" fill="currentColor" fillOpacity="0.4">
        z
      </text>
    </svg>
  );
}
