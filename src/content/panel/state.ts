export type PanelStatus = 'idle' | 'streaming' | 'complete' | 'error' | 'not-configured';

export interface PanelState {
  title: string;
  text: string;
  status: PanelStatus;
  error: string | null;
  providerLabel: string | null;
}

export type PanelAction =
  | { type: 'reset'; title: string; providerLabel?: string | null }
  | { type: 'delta'; delta: string }
  | { type: 'complete' }
  | { type: 'error'; message: string; notConfigured?: boolean };

export function createInitialPanelState(title = ''): PanelState {
  return {
    title,
    text: '',
    status: 'idle',
    error: null,
    providerLabel: null,
  };
}

export function panelReducer(state: PanelState, action: PanelAction): PanelState {
  switch (action.type) {
    case 'reset':
      return {
        title: action.title,
        text: '',
        status: 'streaming',
        error: null,
        providerLabel: action.providerLabel ?? null,
      };
    case 'delta':
      return {
        ...state,
        status: 'streaming',
        text: state.text + action.delta,
      };
    case 'complete':
      return { ...state, status: 'complete', error: null };
    case 'error':
      return {
        ...state,
        status: action.notConfigured ? 'not-configured' : 'error',
        error: action.message,
      };
  }
}
