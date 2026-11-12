import type { ActionResult, Column } from '../contracts';

type TableResult = Extract<ActionResult, { kind: 'table' }>;
type Cell = string | number | boolean | null;

function escapeCell(value: Cell): string {
  if (value === null) return '';
  const text = typeof value === 'string' ? value : String(value);
  if (/[",\r\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

export function toCsv(result: TableResult): string {
  const header = result.columns.map((column) => escapeCell(column.label)).join(',');
  const lines = result.rows.map((row) =>
    result.columns.map((column) => escapeCell(row[column.key] ?? null)).join(','),
  );
  return [header, ...lines].join('\r\n');
}

export function inferColumnType(key: string, values: Cell[]): Column['type'] {
  if (key === 'url' || key.endsWith('Url') || key.endsWith('_url')) return 'url';
  if (key === 'price' || key === 'salary' || key === 'rent') return 'currency';
  if (key === 'available' || key === 'remote') return 'boolean';
  if (key.includes('date') || key.endsWith('At')) return 'date';

  const defined = values.filter((value) => value !== null);
  if (defined.length === 0) return 'text';
  if (defined.every((value) => typeof value === 'boolean')) return 'boolean';
  if (defined.every((value) => typeof value === 'number')) return 'number';
  if (defined.every((value) => typeof value === 'string' && /^https?:\/\//i.test(value))) {
    return 'url';
  }
  return 'text';
}
