/**
 * Local-only latency instrumentation. Nothing here leaves the device; a future telemetry
 * sink must be opt-in and must never include page content.
 */
export type MetricName = 'menu.open' | 'menu.action-selected' | 'inline.first-token';

export interface MetricSample {
  name: MetricName;
  durationMs: number;
  at: number;
}

/** Engineering targets from the PRD, not guarantees. */
export const LATENCY_TARGETS_MS: Partial<Record<MetricName, number>> = {
  'menu.open': 100,
};

const MAX_SAMPLES = 100;

export function createMetricsRecorder(now: () => number = () => Date.now()) {
  const samples: MetricSample[] = [];
  return {
    record(name: MetricName, durationMs: number): MetricSample {
      const sample = { name, durationMs: Math.max(0, durationMs), at: now() };
      samples.push(sample);
      if (samples.length > MAX_SAMPLES) samples.shift();
      return sample;
    },
    samples(name?: MetricName): MetricSample[] {
      return name ? samples.filter((s) => s.name === name) : [...samples];
    },
  };
}

export type MetricsRecorder = ReturnType<typeof createMetricsRecorder>;
