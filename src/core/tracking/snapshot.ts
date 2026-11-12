import {
  TrackerSnapshotSchema,
  type ExtractedItem,
  type Money,
  type SelectedContext,
  type TrackerAvailability,
  type TrackerSnapshot,
} from '../contracts';
import { parseMoney } from '../normalize';
import { extractFromDocument, filterItemsBySelectedContext } from '../sources';

function availabilityOf(raw: string | number | boolean | null): TrackerAvailability | undefined {
  if (typeof raw !== 'string') return undefined;
  const lower = raw.toLowerCase();
  if (lower.includes('in-stock') || lower.includes('instock') || lower === 'in stock') {
    return 'in-stock';
  }
  if (lower.includes('out-of-stock') || lower.includes('outofstock') || lower.includes('sold')) {
    return 'out-of-stock';
  }
  if (lower.includes('preorder') || lower.includes('pre-order')) return 'preorder';
  if (lower === 'unknown') return 'unknown';
  return 'unknown';
}

function priceOf(item: ExtractedItem): Money | undefined {
  const priceField = item.fields.price;
  if (!priceField) return undefined;
  const currencyField = item.fields.currency;
  if (typeof priceField.value === 'number') {
    const currency =
      typeof currencyField?.value === 'string'
        ? currencyField.value.toUpperCase()
        : parseMoney(priceField.raw ?? '', null)?.currency;
    if (currency?.length !== 3) return undefined;
    return { amount: priceField.value, currency };
  }
  if (typeof priceField.value === 'string' || priceField.raw) {
    const parsed = parseMoney(
      priceField.raw ?? String(priceField.value),
      typeof currencyField?.value === 'string' ? currencyField.value : null,
    );
    return parsed ?? undefined;
  }
  return undefined;
}

/** Picks the most product-like item for tracking. */
export function primaryTrackItem(items: ExtractedItem[]): ExtractedItem | undefined {
  return (
    items.find((item) => item.kind === 'product' || item.kind === 'offer') ??
    items.find((item) => item.fields.price) ??
    items[0]
  );
}

export function snapshotFromItem(
  item: ExtractedItem,
  sourceUrl: string,
  capturedAt = new Date().toISOString(),
): TrackerSnapshot {
  const availabilityRaw = item.fields.availability?.value ?? null;
  return TrackerSnapshotSchema.parse({
    capturedAt,
    sourceUrl,
    fields: { name: item.name, ...item.fields },
    price: priceOf(item),
    availability: availabilityOf(availabilityRaw),
  });
}

export function snapshotFromDocument(
  doc: Document,
  pageUrl: string,
  capturedAt = new Date().toISOString(),
  context?: SelectedContext,
): TrackerSnapshot | null {
  const items = extractFromDocument(doc, pageUrl);
  const scoped = context ? filterItemsBySelectedContext(items, context) : items;
  const item = primaryTrackItem(scoped);
  if (!item) return null;
  return snapshotFromItem(item, pageUrl, capturedAt);
}
