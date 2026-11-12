import { describe, expect, it } from 'vitest';
import type { TrackerSnapshot } from '../contracts';
import { evaluateCondition } from './condition';

const base: TrackerSnapshot = {
  capturedAt: '2026-11-12T04:00:00.000Z',
  sourceUrl: 'https://shop.example/lamp',
  fields: {
    price: { value: 100, sourceUrl: 'https://shop.example/lamp' },
  },
  price: { amount: 100, currency: 'USD' },
  availability: 'in-stock',
};

describe('evaluateCondition', () => {
  it('detects price-below without inventing a hit when price is missing', () => {
    expect(
      evaluateCondition({ kind: 'price-below', threshold: { amount: 90, currency: 'USD' } }, base, {
        ...base,
        price: { amount: 80, currency: 'USD' },
      }),
    ).toBe(true);
    expect(
      evaluateCondition({ kind: 'price-below', threshold: { amount: 90, currency: 'USD' } }, base, {
        ...base,
        price: undefined,
        fields: {},
      }),
    ).toBe(false);
  });

  it('detects availability changes and ignores identical snapshots', () => {
    expect(
      evaluateCondition({ kind: 'availability-change' }, base, {
        ...base,
        availability: 'out-of-stock',
      }),
    ).toBe(true);
    expect(evaluateCondition({ kind: 'availability-change' }, base, base)).toBe(false);
  });

  it('detects price-change only when both snapshots have prices', () => {
    expect(
      evaluateCondition({ kind: 'price-change' }, base, {
        ...base,
        price: { amount: 110, currency: 'USD' },
      }),
    ).toBe(true);
    expect(
      evaluateCondition({ kind: 'price-change' }, undefined, {
        ...base,
        price: { amount: 110, currency: 'USD' },
      }),
    ).toBe(false);
  });
});
