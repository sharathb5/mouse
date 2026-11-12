import { describe, expect, it } from 'vitest';
import {
  DestinationsConfigSchema,
  findActiveTrustedRule,
  parseDestinationsConfig,
  SavedActionSchema,
  TrustedRuleSchema,
} from './destinations-config';

describe('DestinationsConfig', () => {
  it('parses the default shape', () => {
    const parsed = DestinationsConfigSchema.parse({
      version: 1,
      destinations: [
        {
          id: 'cursor-default',
          label: 'Cursor Cloud Agent',
          isDefault: true,
          integration: 'cursor-cloud-agent',
          capability: 'background-execution',
        },
      ],
      savedActions: [],
      trustedRules: [],
    });
    expect(parsed.destinations[0]?.isDefault).toBe(true);
  });

  it('repairs corrupt storage without wiping destinations when possible', () => {
    const repaired = parseDestinationsConfig({
      version: 99,
      destinations: [
        {
          id: 'cursor-default',
          label: 'Cursor Cloud Agent',
          isDefault: true,
          integration: 'cursor-cloud-agent',
          capability: 'background-execution',
        },
        {
          id: 'other',
          label: 'Also default',
          isDefault: true,
          integration: 'clipboard',
          capability: 'copy-only',
        },
      ],
      savedActions: 'nope',
      trustedRules: [],
    });
    expect(repaired.version).toBe(1);
    expect(repaired.destinations.filter((d) => d.isDefault)).toHaveLength(1);
    expect(repaired.savedActions).toEqual([]);
  });

  it('validates saved actions and trusted rules', () => {
    expect(
      SavedActionSchema.safeParse({
        id: 'sa1',
        name: 'Fix this',
        destinationId: 'cursor-default',
        instructionTemplate: 'Please fix: {selection}',
        createdAt: '2026-11-12T04:00:00.000Z',
      }).success,
    ).toBe(true);

    expect(
      TrustedRuleSchema.safeParse({
        id: 'rule1',
        originPattern: 'https://github.com',
        destinationId: 'cursor-default',
        createdAt: '2026-11-12T04:00:00.000Z',
      }).success,
    ).toBe(true);
  });

  it('matches active trusted rules by origin', () => {
    const rules = [
      {
        id: 'rule1',
        originPattern: 'https://github.com',
        destinationId: 'cursor-default',
        createdAt: '2026-11-12T04:00:00.000Z',
      },
      {
        id: 'rule2',
        originPattern: 'https://github.com',
        destinationId: 'cursor-default',
        createdAt: '2026-11-12T04:00:00.000Z',
        revokedAt: '2026-11-12T05:00:00.000Z',
      },
    ];
    expect(findActiveTrustedRule(rules, 'https://github.com/org/repo', 'cursor-default')?.id).toBe(
      'rule1',
    );
    expect(findActiveTrustedRule(rules, 'https://example.com', 'cursor-default')).toBeUndefined();
  });
});
