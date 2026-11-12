import { describe, expect, it } from 'vitest';
import type { ExtractedItem } from '../contracts';
import { normalizeDate } from './dates';
import { parseMoney } from './money';
import { toCsv } from './csv';
import { normalize, sourcesFor } from './table';

const lamp: ExtractedItem = {
  id: 'p1',
  kind: 'product',
  name: { value: 'Lamp', sourceUrl: 'https://shop.example/lamp' },
  url: 'https://shop.example/lamp',
  fields: {
    price: { value: 79, sourceUrl: 'https://shop.example/lamp', raw: '$79.00' },
    currency: { value: 'USD', sourceUrl: 'https://shop.example/lamp' },
    brand: { value: 'Northbeam', sourceUrl: 'https://shop.example/lamp' },
  },
  adapterId: 'json-ld',
};

const stand: ExtractedItem = {
  id: 'p2',
  kind: 'product',
  name: { value: 'Stand', sourceUrl: 'https://shop.example/stand' },
  url: 'https://shop.example/stand',
  fields: {
    price: { value: 129, sourceUrl: 'https://shop.example/stand' },
    currency: { value: 'USD', sourceUrl: 'https://shop.example/stand' },
  },
  adapterId: 'json-ld',
};

describe('parseMoney', () => {
  it('handles symbols, codes, and locale-ish thousands separators', () => {
    expect(parseMoney('$1,299.50')).toEqual({ amount: 1299.5, currency: 'USD' });
    expect(parseMoney('€40')).toEqual({ amount: 40, currency: 'EUR' });
    expect(parseMoney('99 GBP')).toEqual({ amount: 99, currency: 'GBP' });
    expect(parseMoney('40', 'usd')).toEqual({ amount: 40, currency: 'USD' });
    expect(parseMoney('nope')).toBeNull();
  });
});

describe('normalizeDate', () => {
  it('accepts ISO and month-name dates, rejects ambiguous numeric forms', () => {
    expect(normalizeDate('2026-11-12')).toBe('2026-11-12');
    expect(normalizeDate('November 12, 2026')).toBe('2026-11-12');
    expect(normalizeDate('11/12/2026')).toBeNull();
  });
});

describe('normalize + toCsv', () => {
  it('builds grounded rows with nulls for missing attributes and escapes CSV', () => {
    const table = normalize([
      lamp,
      {
        ...stand,
        name: { value: 'Stand, "Oak"', sourceUrl: stand.name.sourceUrl },
        fields: { ...stand.fields, brand: { value: null, sourceUrl: stand.name.sourceUrl } },
      },
    ]);
    expect(table.columns.map((column) => column.key)).toContain('price');
    expect(table.rows[1]?.brand).toBeNull();
    const csv = toCsv({ kind: 'table', ...table, sources: sourcesFor([lamp, stand]) });
    expect(csv.split(/\r?\n/)[0]).toContain('Name');
    expect(csv).toContain('"Stand, ""Oak"""');
  });
});
