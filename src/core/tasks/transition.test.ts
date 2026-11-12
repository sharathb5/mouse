import { describe, expect, it } from 'vitest';
import type { ActionResult } from '../contracts/result';
import type { TaskEvent } from '../contracts/task-events';
import type { TaskState } from '../contracts/task';
import { IllegalTaskTransitionError, transition } from './transition';

const now = '2026-11-12T04:00:00.000Z';
const later = '2026-11-12T04:05:00.000Z';
const result: ActionResult = {
  kind: 'handoff',
  destinationId: 'cursor-default',
  outcome: { mode: 'task-created', taskId: 't1' },
};
const error = { code: 'provider' as const, message: 'boom', retryable: true };

const queued: TaskState = { status: 'queued' };
const running: TaskState = {
  status: 'running',
  progress: { mode: 'indeterminate', label: 'Working' },
  updates: [{ at: now, message: 'Started' }],
};
const monitoring: TaskState = {
  status: 'monitoring',
  nextCheckAt: later,
  paused: false,
};
const completed: TaskState = { status: 'completed', result, completedAt: now };
const failed: TaskState = { status: 'failed', error, failedAt: now };
const cancelled: TaskState = { status: 'cancelled', cancelledAt: now };

describe('transition', () => {
  it('keeps queued on enqueue', () => {
    expect(transition(queued, { type: 'enqueue' })).toEqual({ status: 'queued' });
  });

  it('starts a queued task as running', () => {
    expect(
      transition(queued, {
        type: 'start',
        progress: { mode: 'determinate', fraction: 0.1, label: 'Kickoff' },
        update: { at: now, message: 'Queued with provider' },
      }),
    ).toEqual({
      status: 'running',
      progress: { mode: 'determinate', fraction: 0.1, label: 'Kickoff' },
      updates: [{ at: now, message: 'Queued with provider' }],
    });
  });

  it('updates progress and appends updates while running', () => {
    const next = transition(running, {
      type: 'progress',
      progress: { mode: 'determinate', fraction: 0.5 },
      update: { at: later, message: 'Halfway' },
    });
    expect(next).toEqual({
      status: 'running',
      progress: { mode: 'determinate', fraction: 0.5 },
      updates: [
        { at: now, message: 'Started' },
        { at: later, message: 'Halfway' },
      ],
    });
  });

  it('records a text-only update without changing progress', () => {
    expect(transition(running, { type: 'update', update: { at: later, message: 'Note' } })).toEqual(
      {
        status: 'running',
        progress: running.progress,
        updates: [...running.updates, { at: later, message: 'Note' }],
      },
    );
  });

  it('enters monitoring from running and supports pause/resume', () => {
    const mon = transition(running, {
      type: 'enter-monitoring',
      nextCheckAt: later,
      lastCheckedAt: now,
      paused: false,
    });
    expect(mon).toEqual({
      status: 'monitoring',
      nextCheckAt: later,
      lastCheckedAt: now,
      paused: false,
    });
    const paused = transition(mon, { type: 'pause-monitoring' });
    expect(paused).toMatchObject({ status: 'monitoring', paused: true });
    expect(
      transition(paused, { type: 'resume-monitoring', nextCheckAt: '2026-11-12T05:00:00.000Z' }),
    ).toMatchObject({
      status: 'monitoring',
      paused: false,
      nextCheckAt: '2026-11-12T05:00:00.000Z',
    });
  });

  it('completes, fails, or cancels from active states', () => {
    for (const state of [queued, running, monitoring]) {
      expect(transition(state, { type: 'complete', result, completedAt: later })).toMatchObject({
        status: 'completed',
      });
      expect(transition(state, { type: 'fail', error, failedAt: later })).toMatchObject({
        status: 'failed',
      });
      expect(transition(state, { type: 'cancel', cancelledAt: later })).toMatchObject({
        status: 'cancelled',
      });
    }
  });

  it('rejects illegal transitions from every status', () => {
    const cases: { state: TaskState; event: TaskEvent }[] = [
      { state: queued, event: { type: 'progress', progress: { mode: 'indeterminate' } } },
      { state: queued, event: { type: 'update', update: { at: now, message: 'x' } } },
      { state: queued, event: { type: 'pause-monitoring' } },
      { state: running, event: { type: 'enqueue' } },
      { state: running, event: { type: 'pause-monitoring' } },
      { state: monitoring, event: { type: 'start', progress: { mode: 'indeterminate' } } },
      { state: monitoring, event: { type: 'progress', progress: { mode: 'indeterminate' } } },
      {
        state: { ...monitoring, paused: true },
        event: { type: 'pause-monitoring' },
      },
      {
        state: { ...monitoring, paused: false },
        event: { type: 'resume-monitoring', nextCheckAt: later },
      },
      { state: completed, event: { type: 'cancel', cancelledAt: later } },
      { state: failed, event: { type: 'complete', result, completedAt: later } },
      { state: cancelled, event: { type: 'enqueue' } },
    ];

    for (const { state, event } of cases) {
      expect(() => transition(state, event)).toThrow(IllegalTaskTransitionError);
    }
  });
});
