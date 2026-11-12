import { describe, expect, it } from 'vitest';
import { createMetricsRecorder } from './metrics';

describe('createMetricsRecorder', () => {
  it('records non-negative samples and filters by name', () => {
    const metrics = createMetricsRecorder(() => 42);
    metrics.record('menu.open', 12.5);
    metrics.record('menu.action-selected', -3);
    expect(metrics.samples('menu.open')).toEqual([{ name: 'menu.open', durationMs: 12.5, at: 42 }]);
    expect(metrics.samples('menu.action-selected')[0]?.durationMs).toBe(0);
  });

  it('keeps a bounded ring buffer', () => {
    const metrics = createMetricsRecorder();
    for (let i = 0; i < 150; i++) metrics.record('menu.open', i);
    const samples = metrics.samples();
    expect(samples).toHaveLength(100);
    expect(samples[0]?.durationMs).toBe(50);
  });
});
