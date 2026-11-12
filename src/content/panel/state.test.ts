import { describe, expect, it } from 'vitest';
import { createInitialPanelState, panelReducer } from './state';

describe('panel streaming reducer', () => {
  it('accumulates deltas then completes', () => {
    let state = createInitialPanelState();
    state = panelReducer(state, { type: 'reset', title: 'Explain This', providerLabel: 'Mock' });
    expect(state.status).toBe('streaming');
    state = panelReducer(state, { type: 'delta', delta: 'Hello ' });
    state = panelReducer(state, { type: 'delta', delta: 'world' });
    expect(state.text).toBe('Hello world');
    state = panelReducer(state, { type: 'complete' });
    expect(state.status).toBe('complete');
  });

  it('marks not-configured distinctly from generic errors', () => {
    let state = createInitialPanelState();
    state = panelReducer(state, {
      type: 'error',
      message: 'OpenRouter API key is not configured.',
      notConfigured: true,
    });
    expect(state.status).toBe('not-configured');
    expect(state.error).toMatch(/not configured/i);
  });
});
