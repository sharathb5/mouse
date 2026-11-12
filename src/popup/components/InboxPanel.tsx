export function InboxPanel() {
  return (
    <div className="inbox-empty" data-testid="inbox-placeholder">
      <SleepingCat />
      <h2>No tasks yet</h2>
      <p>
        Work you delegate to agents, comparisons, and trackers will show up here with live progress.
      </p>
      <p className="pill">Task execution is not available in this build</p>
    </div>
  );
}

function SleepingCat() {
  return (
    <svg className="cat" viewBox="0 0 96 48" width="96" height="48" aria-hidden="true">
      <line
        x1="4"
        y1="44"
        x2="92"
        y2="44"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M30 43c-6 0-9-4-9-9 0-7 7-12 17-12h12c3-5 6-8 8-8l1 6c4 1 7 4 8 8 6 0 9 4 9 8 0 4-3 7-8 7z"
        fill="currentColor"
        fillOpacity="0.85"
      />
      <path
        d="M21 36c-5 0-9 2-11 6"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.85"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M62 30q2 1.5 4 0"
        fill="none"
        stroke="#fff"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <text x="72" y="16" fontSize="9" fill="currentColor" fillOpacity="0.6" fontFamily="system-ui">
        z
      </text>
      <text x="79" y="9" fontSize="7" fill="currentColor" fillOpacity="0.45" fontFamily="system-ui">
        z
      </text>
    </svg>
  );
}
