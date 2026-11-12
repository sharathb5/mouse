/**
 * Normalizes common date strings to ISO-8601 calendar dates (YYYY-MM-DD) when possible.
 * Returns null rather than guessing an ambiguous locale format.
 */
export function normalizeDate(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (/^\d{4}-\d{2}-\d{2}/.exec(trimmed)) {
    const date = new Date(trimmed);
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
  }

  // Strict month-name forms only; numeric M/D/YYYY stays null (ambiguous).
  const monthName =
    /^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$|^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/.exec(trimmed);
  if (monthName) {
    const date = new Date(trimmed);
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
  }

  const isoInstant = Date.parse(trimmed);
  if (!Number.isNaN(isoInstant) && /[TZtz]|GMT|UTC/.test(trimmed)) {
    return new Date(isoInstant).toISOString().slice(0, 10);
  }

  return null;
}
