import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  ACTION_IDS,
  ActionInputSchema,
  ActionResultSchema,
  AgentDestinationSchema,
  BackgroundMessageSchema,
  ContentScriptMessageSchema,
  ExtractedItemSchema,
  PageClassificationSchema,
  SelectedContextSchema,
  TaskRequestSchema,
  TaskStateSchema,
  TrackerSchema,
  TrackerSnapshotSchema,
  canCreateTask,
  isActiveTask,
  parseTrackerStoreState,
  type ActionId,
  type ActionInput,
  type SelectedContext,
} from './index';

const context: SelectedContext = {
  untrusted: true,
  source: {
    url: 'https://example.com/post',
    title: 'Example post',
    capturedAt: '2026-11-12T03:00:00.000Z',
    frame: 'top',
  },
  target: {
    kind: 'text-selection',
    text: 'Agents are useful.',
    blocks: [{ type: 'paragraph', text: 'Agents are useful.' }],
  },
  page: { kind: 'article', confidence: 0.9, signals: ['<article> element'] },
  containsSensitiveData: false,
};

const cursorDestination = {
  id: 'cursor',
  label: 'Cursor Cloud Agent',
  isDefault: true,
  integration: 'cursor-cloud-agent',
  capability: 'background-execution',
  repository: 'github.com/sharathb5/mouse',
} as const;

const chatgptLink = {
  id: 'chatgpt',
  label: 'ChatGPT',
  isDefault: false,
  integration: 'prefill-link',
  capability: 'prefill-only',
  provider: 'chatgpt',
  urlTemplate: 'https://chatgpt.com/?q={prompt}',
} as const;

describe('ActionInputSchema', () => {
  it('has exactly one input variant per action id', () => {
    const variantIds = ActionInputSchema.options.map((option) => option.shape.actionId.value);
    expect([...variantIds].sort()).toEqual([...ACTION_IDS].sort());
    expectTypeOf<ActionInput['actionId']>().toEqualTypeOf<ActionId>();
  });

  it('accepts a valid translate input and rejects missing action-specific fields', () => {
    expect(
      ActionInputSchema.safeParse({ actionId: 'translate', context, targetLanguage: 'es' }).success,
    ).toBe(true);
    expect(ActionInputSchema.safeParse({ actionId: 'translate', context }).success).toBe(false);
  });

  it('rejects unknown action ids', () => {
    expect(ActionInputSchema.safeParse({ actionId: 'delete-everything', context }).success).toBe(
      false,
    );
  });

  it('validates track conditions as a discriminated union', () => {
    const input = {
      actionId: 'track',
      context,
      condition: { kind: 'price-below', threshold: { amount: 99, currency: 'USD' } },
    };
    expect(ActionInputSchema.safeParse(input).success).toBe(true);
    expect(
      ActionInputSchema.safeParse({ ...input, condition: { kind: 'price-below' } }).success,
    ).toBe(false);
  });
});

describe('SelectedContextSchema', () => {
  it('requires the untrusted marker', () => {
    expect(SelectedContextSchema.safeParse(context).success).toBe(true);
    expect(SelectedContextSchema.safeParse({ ...context, untrusted: false }).success).toBe(false);
  });

  it('rejects non-URL sources', () => {
    expect(
      SelectedContextSchema.safeParse({
        ...context,
        source: { ...context.source, url: 'not a url' },
      }).success,
    ).toBe(false);
  });
});

describe('PageClassificationSchema', () => {
  it('requires kind-specific facets', () => {
    expect(
      PageClassificationSchema.safeParse({
        kind: 'github-issue',
        confidence: 1,
        signals: [],
        repository: 'sharathb5/mouse',
        issueNumber: 12,
        isPullRequest: false,
      }).success,
    ).toBe(true);
    expect(
      PageClassificationSchema.safeParse({ kind: 'github-issue', confidence: 1, signals: [] })
        .success,
    ).toBe(false);
  });

  it('bounds confidence to 0..1', () => {
    expect(
      PageClassificationSchema.safeParse({ kind: 'article', confidence: 1.5, signals: [] }).success,
    ).toBe(false);
  });
});

describe('AgentDestinationSchema', () => {
  it('parses each integration and only lets background-capable ones create tasks', () => {
    const cursor = AgentDestinationSchema.parse(cursorDestination);
    const link = AgentDestinationSchema.parse(chatgptLink);
    expect(canCreateTask(cursor)).toBe(true);
    expect(canCreateTask(link)).toBe(false);
  });

  it('rejects a prefill link that claims background execution', () => {
    expect(
      AgentDestinationSchema.safeParse({ ...chatgptLink, capability: 'background-execution' })
        .success,
    ).toBe(false);
  });

  it('requires a {prompt} placeholder in prefill templates', () => {
    expect(
      AgentDestinationSchema.safeParse({ ...chatgptLink, urlTemplate: 'https://chatgpt.com/' })
        .success,
    ).toBe(false);
  });
});

describe('TaskRequestSchema', () => {
  const input = { actionId: 'send-to-agent', context, destinationId: 'cursor' };

  it('accepts an agent task on a background-capable destination', () => {
    expect(
      TaskRequestSchema.safeParse({
        id: 'task-1',
        input,
        executor: { kind: 'agent', destination: cursorDestination },
        approval: { kind: 'explicit', approvedAt: '2026-11-12T03:00:00.000Z' },
        createdAt: '2026-11-12T03:00:00.000Z',
      }).success,
    ).toBe(true);
  });

  it('refuses to model a prefilled chat link as a running task', () => {
    expect(
      TaskRequestSchema.safeParse({
        id: 'task-2',
        input,
        executor: { kind: 'agent', destination: chatgptLink },
        approval: { kind: 'not-required' },
        createdAt: '2026-11-12T03:00:00.000Z',
      }).success,
    ).toBe(false);
  });
});

describe('TaskStateSchema', () => {
  it('distinguishes determinate and indeterminate progress', () => {
    expect(
      TaskStateSchema.safeParse({
        status: 'running',
        progress: { mode: 'indeterminate' },
        updates: [],
      }).success,
    ).toBe(true);
    expect(
      TaskStateSchema.safeParse({
        status: 'running',
        progress: { mode: 'determinate', fraction: 1.2 },
        updates: [],
      }).success,
    ).toBe(false);
  });

  it('counts queued, running, and monitoring tasks as active', () => {
    expect(isActiveTask({ status: 'queued' })).toBe(true);
    expect(
      isActiveTask({
        status: 'monitoring',
        nextCheckAt: '2026-11-12T04:00:00.000Z',
        paused: false,
      }),
    ).toBe(true);
    expect(isActiveTask({ status: 'cancelled', cancelledAt: '2026-11-12T04:00:00.000Z' })).toBe(
      false,
    );
  });
});

describe('ActionResultSchema', () => {
  it('requires at least two items for a comparison', () => {
    const item = { name: 'A', url: 'https://example.com/a', values: { price: 10 } };
    const result = {
      kind: 'comparison',
      attributes: [{ key: 'price', label: 'Price', type: 'currency' }],
      items: [item],
      summary: '',
      sources: [],
    };
    expect(ActionResultSchema.safeParse(result).success).toBe(false);
    expect(ActionResultSchema.safeParse({ ...result, items: [item, item] }).success).toBe(true);
  });

  it('models handoff outcomes explicitly', () => {
    expect(
      ActionResultSchema.safeParse({
        kind: 'handoff',
        destinationId: 'chatgpt',
        outcome: { mode: 'prefill-opened', url: 'https://chatgpt.com/?q=hi' },
      }).success,
    ).toBe(true);
  });
});

describe('ContentScriptMessageSchema', () => {
  it('accepts known messages and rejects anything else', () => {
    expect(ContentScriptMessageSchema.safeParse({ type: 'agentic-mouse/ping' }).success).toBe(true);
    expect(
      ContentScriptMessageSchema.safeParse({ type: 'agentic-mouse/extract-snapshot' }).success,
    ).toBe(true);
    expect(
      ContentScriptMessageSchema.safeParse({ type: 'agentic-mouse/open-menu', source: 'page' })
        .success,
    ).toBe(false);
    expect(ContentScriptMessageSchema.safeParse({ type: 'eval', code: '1' }).success).toBe(false);
  });
});

describe('ExtractedItemSchema', () => {
  it('requires per-value provenance', () => {
    expect(
      ExtractedItemSchema.safeParse({
        id: 'p1',
        kind: 'product',
        name: { value: 'Lamp', sourceUrl: 'https://shop.example/p/1' },
        fields: {
          price: { value: 42, sourceUrl: 'https://shop.example/p/1', raw: '$42.00' },
        },
        adapterId: 'json-ld',
      }).success,
    ).toBe(true);
    expect(
      ExtractedItemSchema.safeParse({
        id: 'p1',
        kind: 'product',
        name: { value: 'Lamp', sourceUrl: 'not-a-url' },
        fields: {},
        adapterId: 'json-ld',
      }).success,
    ).toBe(false);
  });
});

describe('TrackerSchema', () => {
  it('accepts a price-below tracker with an optional snapshot', () => {
    const snapshot = TrackerSnapshotSchema.parse({
      capturedAt: '2026-11-12T04:00:00.000Z',
      sourceUrl: 'https://shop.example/p/1',
      fields: {
        price: { value: 120, sourceUrl: 'https://shop.example/p/1', raw: '$120' },
      },
      price: { amount: 120, currency: 'USD' },
      availability: 'in-stock',
    });
    expect(
      TrackerSchema.safeParse({
        id: 'trk-1',
        taskId: 'task-1',
        url: 'https://shop.example/p/1',
        title: 'Lamp',
        condition: { kind: 'price-below', threshold: { amount: 100, currency: 'USD' } },
        createdAt: '2026-11-12T04:00:00.000Z',
        paused: false,
        lastSnapshot: snapshot,
        nextCheckAt: '2026-11-12T04:15:00.000Z',
        conditionMet: false,
      }).success,
    ).toBe(true);
  });

  it('defensively parses a tracker store blob', () => {
    expect(parseTrackerStoreState({ version: 1, trackers: [{ id: 'bad' }] })).toEqual({
      version: 1,
      trackers: [],
    });
  });
});

describe('BackgroundMessageSchema', () => {
  it('accepts track lifecycle commands', () => {
    expect(
      BackgroundMessageSchema.safeParse({
        type: 'agentic-mouse/track/check-now',
        trackerId: 'trk-1',
      }).success,
    ).toBe(true);
    expect(BackgroundMessageSchema.safeParse({ type: 'agentic-mouse/track/list' }).success).toBe(
      true,
    );
  });

  it('accepts alternatives ranking and sheets messages', () => {
    expect(
      BackgroundMessageSchema.safeParse({
        type: 'agentic-mouse/alternatives/rank-links',
        seed: { name: 'Lamp', kind: 'product', fields: { price: 10 } },
        links: [{ url: 'http://127.0.0.1:4321/b', text: 'Stand' }],
      }).success,
    ).toBe(true);
    expect(BackgroundMessageSchema.safeParse({ type: 'agentic-mouse/sheets/status' }).success).toBe(
      true,
    );
    expect(
      BackgroundMessageSchema.safeParse({
        type: 'agentic-mouse/sheets/export',
        table: {
          columns: [{ key: 'name', label: 'Name', type: 'text' }],
          rows: [{ name: 'Lamp' }],
          sources: ['http://127.0.0.1:4321/products.html'],
        },
      }).success,
    ).toBe(true);
  });
});

describe('ActionResult notice fields', () => {
  it('allows optional honest notices on table and comparison results', () => {
    expect(
      ActionResultSchema.safeParse({
        kind: 'table',
        columns: [{ key: 'name', label: 'Name', type: 'text' }],
        rows: [{ name: 'Lamp' }],
        sources: ['http://127.0.0.1:4321/products.html'],
        notice: 'Google Sheets is not connected.',
      }).success,
    ).toBe(true);
    expect(
      ActionResultSchema.safeParse({
        kind: 'comparison',
        attributes: [{ key: 'price', label: 'Price', type: 'currency' }],
        items: [
          { name: 'A', url: 'https://example.com/a', values: { price: 1 } },
          { name: 'B', url: 'https://example.com/b', values: { price: 2 } },
        ],
        summary: 'Compared 2 items.',
        sources: ['https://example.com/a'],
        notice: 'OpenRouter is not configured.',
      }).success,
    ).toBe(true);
  });
});
