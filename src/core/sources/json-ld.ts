import {
  ExtractedItemSchema,
  type ExtractedItem,
  type ExtractedItemKind,
  type ProvenancedValue,
} from '../contracts';
import type { SourceAdapter } from './types';

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function typeTokens(node: Record<string, unknown>): string[] {
  const raw = node['@type'];
  if (typeof raw === 'string') return [raw];
  if (Array.isArray(raw)) return raw.filter((entry): entry is string => typeof entry === 'string');
  return [];
}

function textOf(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  const record = asRecord(value);
  if (!record) return null;
  for (const key of ['name', 'title', 'text', '@value']) {
    const nested = textOf(record[key]);
    if (nested) return nested;
  }
  return null;
}

function numberOf(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9.-]/g, '');
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  const record = asRecord(value);
  if (record && 'value' in record) return numberOf(record.value);
  return null;
}

function provenanced(
  value: string | number | boolean | null,
  sourceUrl: string,
  raw?: string,
): ProvenancedValue {
  return raw === undefined ? { value, sourceUrl } : { value, sourceUrl, raw };
}

function resolveUrl(base: URL, value: unknown): string | undefined {
  const text = textOf(value);
  if (!text) return undefined;
  try {
    return new URL(text, base).href;
  } catch {
    return undefined;
  }
}

function walkNodes(root: unknown): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const entry of node) visit(entry);
      return;
    }
    const record = asRecord(node);
    if (!record) return;
    out.push(record);
    if ('@graph' in record) visit(record['@graph']);
  };
  visit(root);
  return out;
}

function parseScripts(doc: Document): unknown[] {
  const payloads: unknown[] = [];
  for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
    const text = script.textContent.trim();
    if (!text) continue;
    try {
      payloads.push(JSON.parse(text) as unknown);
    } catch {
      // Ignore malformed JSON-LD blocks rather than inventing data.
    }
  }
  return payloads;
}

function kindForTypes(types: string[]): ExtractedItemKind | null {
  const lower = types.map((token) => token.toLowerCase());
  if (lower.some((token) => token.includes('product'))) return 'product';
  if (lower.some((token) => token.includes('offer'))) return 'offer';
  if (lower.some((token) => token.includes('jobposting') || token.includes('job'))) return 'job';
  if (
    lower.some(
      (token) =>
        token.includes('residence') ||
        token.includes('apartment') ||
        token.includes('houselisting') ||
        token.includes('accommodation') ||
        token.includes('realestatelisting'),
    )
  ) {
    return 'residence';
  }
  return null;
}

function offerFields(
  offer: Record<string, unknown>,
  sourceUrl: string,
): Record<string, ProvenancedValue> {
  const fields: Record<string, ProvenancedValue> = {};
  const price = numberOf(offer.price ?? offer.lowPrice);
  if (price !== null) {
    fields.price = provenanced(
      price,
      sourceUrl,
      textOf(offer.price ?? offer.lowPrice) ?? undefined,
    );
  }
  const currency = textOf(offer.priceCurrency);
  if (currency) fields.currency = provenanced(currency.toUpperCase(), sourceUrl, currency);
  const availability = textOf(offer.availability);
  if (availability) {
    fields.availability = provenanced(normalizeAvailability(availability), sourceUrl, availability);
  }
  return fields;
}

function normalizeAvailability(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes('instock') || lower.includes('in_stock') || lower.includes('in-stock')) {
    return 'in-stock';
  }
  if (lower.includes('outofstock') || lower.includes('out_of_stock') || lower.includes('sold')) {
    return 'out-of-stock';
  }
  if (lower.includes('preorder') || lower.includes('pre-order')) return 'preorder';
  return 'unknown';
}

function itemFromNode(
  node: Record<string, unknown>,
  pageUrl: URL,
  index: number,
): ExtractedItem | null {
  const types = typeTokens(node);
  const kind = kindForTypes(types);
  if (!kind) return null;

  const sourceUrl = resolveUrl(pageUrl, node.url ?? node['@id']) ?? pageUrl.href;
  const nameText =
    textOf(node.name) ?? textOf(node.title) ?? textOf(node.headline) ?? textOf(node.sku);
  if (!nameText) return null;

  const fields: Record<string, ProvenancedValue> = {};

  if (kind === 'product' || kind === 'offer') {
    const offers = node.offers;
    const offerRecord = asRecord(offers);
    const offerNodes: Record<string, unknown>[] = Array.isArray(offers)
      ? offers.map(asRecord).filter((entry): entry is Record<string, unknown> => entry !== null)
      : offerRecord
        ? [offerRecord]
        : [node];
    for (const offer of offerNodes) {
      Object.assign(fields, offerFields(offer, sourceUrl));
    }
    const brand = textOf(node.brand);
    if (brand) fields.brand = provenanced(brand, sourceUrl, brand);
    const sku = textOf(node.sku);
    if (sku) fields.sku = provenanced(sku, sourceUrl, sku);
  }

  if (kind === 'job') {
    const company = textOf(asRecord(node.hiringOrganization)?.name ?? node.hiringOrganization);
    if (company) fields.company = provenanced(company, sourceUrl, company);
    const location = textOf(
      asRecord(node.jobLocation)?.name ??
        asRecord(asRecord(node.jobLocation)?.address)?.addressLocality ??
        node.jobLocation,
    );
    if (location) fields.location = provenanced(location, sourceUrl, location);
    const salaryNode = asRecord(node.baseSalary) ?? asRecord(asRecord(node.baseSalary)?.value);
    const salary = numberOf(salaryNode?.value ?? salaryNode?.minValue ?? node.baseSalary);
    if (salary !== null) {
      fields.salary = provenanced(
        salary,
        sourceUrl,
        textOf(salaryNode?.value ?? salaryNode?.minValue ?? node.baseSalary) ?? undefined,
      );
    }
    const currency = textOf(asRecord(node.baseSalary)?.currency ?? salaryNode?.currency);
    if (currency) fields.currency = provenanced(currency.toUpperCase(), sourceUrl, currency);
    const employmentType = textOf(node.employmentType);
    if (employmentType) {
      fields.employmentType = provenanced(employmentType, sourceUrl, employmentType);
    }
  }

  if (kind === 'residence') {
    const price = numberOf(node.price ?? asRecord(node.offers)?.price);
    if (price !== null) {
      fields.price = provenanced(
        price,
        sourceUrl,
        textOf(node.price ?? asRecord(node.offers)?.price) ?? undefined,
      );
    }
    const currency = textOf(node.priceCurrency ?? asRecord(node.offers)?.priceCurrency);
    if (currency) fields.currency = provenanced(currency.toUpperCase(), sourceUrl, currency);
    const beds = numberOf(node.numberOfBedrooms ?? node.bedrooms);
    if (beds !== null) fields.bedrooms = provenanced(beds, sourceUrl);
    const baths = numberOf(node.numberOfBathroomsTotal ?? node.bathrooms);
    if (baths !== null) fields.bathrooms = provenanced(baths, sourceUrl);
    const sqft = numberOf(node.floorSize ?? asRecord(node.floorSize)?.value);
    if (sqft !== null) {
      fields.sqft = provenanced(sqft, sourceUrl, textOf(node.floorSize) ?? undefined);
    }
    const locality = textOf(
      asRecord(node.address)?.addressLocality ?? asRecord(node.address)?.name ?? node.address,
    );
    if (locality) fields.location = provenanced(locality, sourceUrl, locality);
  }

  const item = {
    id: `${kind}-${index}-${nameText}`.toLowerCase().replace(/\s+/g, '-').slice(0, 80),
    kind,
    name: provenanced(nameText, sourceUrl, nameText),
    url: sourceUrl,
    fields,
    adapterId: 'json-ld',
  };
  return ExtractedItemSchema.parse(item);
}

export const jsonLdAdapter: SourceAdapter = {
  id: 'json-ld',
  matches(_url, doc) {
    return doc.querySelector('script[type="application/ld+json"]') !== null;
  },
  extractItems(doc, url) {
    const items: ExtractedItem[] = [];
    let index = 0;
    for (const payload of parseScripts(doc)) {
      for (const node of walkNodes(payload)) {
        const item = itemFromNode(node, url, index);
        if (item) {
          items.push(item);
          index += 1;
        }
      }
    }
    return items;
  },
};
