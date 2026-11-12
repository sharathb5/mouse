import { describe, expect, it } from 'vitest';
import { ACTION_IDS, ActionDefinitionSchema } from '../contracts';
import { ACTION_CATALOG } from './catalog';
import { COMING_SOON_REASON, createActionRegistry, type ActionExecutor } from './registry';

const explainExecutor: ActionExecutor<'explain'> = {
  actionId: 'explain',
  async *execute() {
    await Promise.resolve();
    yield { type: 'text-delta', delta: 'hi' };
  },
};

describe('ACTION_CATALOG', () => {
  it('defines every action id with a valid definition', () => {
    for (const id of ACTION_IDS) {
      expect(ActionDefinitionSchema.parse(ACTION_CATALOG[id]).id).toBe(id);
    }
  });

  it('includes every locked V1 action label', () => {
    const labels = Object.values(ACTION_CATALOG).map((d) => d.label);
    for (const label of [
      'Explain This',
      'Select Content',
      'Send to Agent',
      'Summarize',
      'Translate',
      'Ask Follow-up',
      'Simplify',
      'Go Deeper',
      'Example',
      'Compare',
      'Extract',
      'Track',
    ]) {
      expect(labels).toContain(label);
    }
  });
});

describe('createActionRegistry', () => {
  it('marks actions without executors as coming soon', () => {
    const registry = createActionRegistry();
    expect(registry.list()).toHaveLength(ACTION_IDS.length);
    for (const entry of registry.list()) {
      expect(entry.availability).toEqual({ status: 'coming-soon', reason: COMING_SOON_REASON });
    }
  });

  it('marks actions with executors as available without touching other actions', () => {
    const registry = createActionRegistry({ executors: [explainExecutor] });
    expect(registry.get('explain').availability).toEqual({ status: 'available' });
    expect(registry.get('summarize').availability.status).toBe('coming-soon');
    expect(registry.getExecutor('explain')).toBe(explainExecutor);
    expect(registry.getExecutor('summarize')).toBeUndefined();
  });

  it('resolves pinned ids in order and skips unknown ids', () => {
    const registry = createActionRegistry();
    expect(
      registry.resolve(['send-to-agent', 'bogus', 'explain']).map((e) => e.definition.label),
    ).toEqual(['Send to Agent', 'Explain This']);
  });

  it('rejects duplicate executors', () => {
    expect(() => createActionRegistry({ executors: [explainExecutor, explainExecutor] })).toThrow(
      /Duplicate executor/,
    );
  });

  it('rejects definitions whose id does not match the key', () => {
    expect(() =>
      createActionRegistry({
        definitions: { ...ACTION_CATALOG, explain: { ...ACTION_CATALOG.summarize } },
      }),
    ).toThrow(/does not match/);
  });
});
