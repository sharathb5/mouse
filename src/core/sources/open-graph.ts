import {
  ExtractedItemSchema,
  type ExtractedItem,
  type ExtractedItemKind,
  type ProvenancedValue,
} from '../contracts';
import type { SourceAdapter } from './types';

function meta(doc: Document, property: string): string | null {
  const el =
    doc.querySelector(`meta[property="${property}"]`) ??
    doc.querySelector(`meta[name="${property}"]`);
  const content = el?.getAttribute('content')?.trim();
  return content ?? null;
}

function provenanced(
  value: string | number | boolean | null,
  sourceUrl: string,
  raw?: string,
): ProvenancedValue {
  return raw === undefined ? { value, sourceUrl } : { value, sourceUrl, raw };
}

function kindFromOg(doc: Document): ExtractedItemKind | null {
  const type = (meta(doc, 'og:type') ?? '').toLowerCase();
  if (type.includes('product')) return 'product';
  if (type.includes('article') || type.includes('website') || type === '') return null;
  return null;
}

function asNumber(raw: string | null): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^0-9.-]/g, '');
  if (!cleaned) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

export const openGraphAdapter: SourceAdapter = {
  id: 'open-graph',
  matches(_url, doc) {
    return meta(doc, 'og:title') !== null && kindFromOg(doc) !== null;
  },
  extractItems(doc, url) {
    const kind = kindFromOg(doc);
    const title = meta(doc, 'og:title') ?? meta(doc, 'twitter:title');
    if (!kind || !title) return [];

    const sourceUrl = meta(doc, 'og:url') ?? url.href;
    const fields: Record<string, ProvenancedValue> = {};
    const priceRaw = meta(doc, 'product:price:amount') ?? meta(doc, 'og:price:amount');
    const price = asNumber(priceRaw);
    if (price !== null) fields.price = provenanced(price, sourceUrl, priceRaw ?? undefined);
    const currency = meta(doc, 'product:price:currency') ?? meta(doc, 'og:price:currency');
    if (currency) fields.currency = provenanced(currency.toUpperCase(), sourceUrl, currency);
    const availability = meta(doc, 'product:availability') ?? meta(doc, 'og:availability');
    if (availability) {
      fields.availability = provenanced(availability, sourceUrl, availability);
    }
    const brand = meta(doc, 'product:brand');
    if (brand) fields.brand = provenanced(brand, sourceUrl, brand);

    const item: ExtractedItem = ExtractedItemSchema.parse({
      id: `og-${kind}-0`,
      kind,
      name: provenanced(title, sourceUrl, title),
      url: sourceUrl,
      fields,
      adapterId: 'open-graph',
    });
    return [item];
  },
};
