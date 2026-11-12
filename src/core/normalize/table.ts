import type { ActionResult, Column, ExtractedItem } from '../contracts';
import { parseMoney } from './money';
import { inferColumnType } from './csv';

type Cell = string | number | boolean | null;
type TableResult = Extract<ActionResult, { kind: 'table' }>;

const FIELD_LABELS: Record<string, string> = {
  name: 'Name',
  url: 'URL',
  price: 'Price',
  currency: 'Currency',
  availability: 'Availability',
  brand: 'Brand',
  sku: 'SKU',
  company: 'Company',
  location: 'Location',
  salary: 'Salary',
  employmentType: 'Employment type',
  bedrooms: 'Bedrooms',
  bathrooms: 'Bathrooms',
  sqft: 'Sq ft',
};

const PREFERRED_ORDER = [
  'name',
  'price',
  'currency',
  'availability',
  'brand',
  'company',
  'location',
  'salary',
  'employmentType',
  'bedrooms',
  'bathrooms',
  'sqft',
  'sku',
  'url',
];

function cellFromItem(item: ExtractedItem, key: string): Cell {
  if (key === 'name') return item.name.value;
  if (key === 'url') return item.url ?? null;
  const field = item.fields[key];
  return field ? field.value : null;
}

function normalizedPrice(item: ExtractedItem): number | null {
  const priceField = item.fields.price;
  if (!priceField) return null;
  if (typeof priceField.value === 'number') return priceField.value;
  if (typeof priceField.value === 'string') {
    const money = parseMoney(
      priceField.raw ?? priceField.value,
      typeof item.fields.currency?.value === 'string' ? item.fields.currency.value : null,
    );
    return money?.amount ?? null;
  }
  return null;
}

/**
 * Turns extracted items into a grounded table. Missing attributes become null.
 * Price fields are normalized to numbers when a currency can be resolved.
 */
export function normalize(items: ExtractedItem[]): Pick<TableResult, 'columns' | 'rows'> {
  const keys = new Set<string>(['name', 'url']);
  for (const item of items) {
    for (const key of Object.keys(item.fields)) keys.add(key);
  }

  const ordered = [
    ...PREFERRED_ORDER.filter((key) => keys.has(key)),
    ...[...keys].filter((key) => !PREFERRED_ORDER.includes(key)).sort(),
  ];

  const rows = items.map((item) => {
    const row: Record<string, Cell> = {};
    for (const key of ordered) {
      if (key === 'price') {
        row[key] = normalizedPrice(item);
      } else {
        row[key] = cellFromItem(item, key);
      }
    }
    return row;
  });

  const columns: Column[] = ordered.map((key) => ({
    key,
    label:
      FIELD_LABELS[key] ?? key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()),
    type: inferColumnType(
      key,
      rows.map((row) => row[key] ?? null),
    ),
  }));

  return { columns, rows };
}

export function sourcesFor(items: ExtractedItem[]): string[] {
  const urls = new Set<string>();
  for (const item of items) {
    urls.add(item.name.sourceUrl);
    if (item.url) urls.add(item.url);
    for (const field of Object.values(item.fields)) urls.add(field.sourceUrl);
  }
  return [...urls];
}
