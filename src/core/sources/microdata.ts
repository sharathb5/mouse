import {
  ExtractedItemSchema,
  type ExtractedItem,
  type ExtractedItemKind,
  type ProvenancedValue,
} from '../contracts';
import type { SourceAdapter } from './types';

function provenanced(
  value: string | number | boolean | null,
  sourceUrl: string,
  raw?: string,
): ProvenancedValue {
  return raw === undefined ? { value, sourceUrl } : { value, sourceUrl, raw };
}

function kindFromItemtype(itemtype: string | null): ExtractedItemKind | null {
  if (!itemtype) return null;
  const lower = itemtype.toLowerCase();
  if (lower.includes('product')) return 'product';
  if (lower.includes('offer')) return 'offer';
  if (lower.includes('jobposting')) return 'job';
  if (
    lower.includes('residence') ||
    lower.includes('apartment') ||
    lower.includes('houselisting') ||
    lower.includes('accommodation')
  ) {
    return 'residence';
  }
  return null;
}

function readProp(el: Element): string {
  for (const attr of ['content', 'href', 'src'] as const) {
    const value = el.getAttribute(attr);
    if (value !== null && value !== '') return value;
  }
  return el.textContent.trim();
}

function propertyMap(root: Element): Map<string, string[]> {
  const map = new Map<string, string[]>();
  const add = (prop: string, content: string) => {
    if (!content) return;
    const list = map.get(prop) ?? [];
    list.push(content);
    map.set(prop, list);
  };

  for (const el of root.querySelectorAll('[itemprop]')) {
    const prop = el.getAttribute('itemprop');
    if (!prop) continue;
    const scope = el.closest('[itemscope]');
    // Direct properties on this scope.
    if (scope === root) {
      add(prop, readProp(el));
      continue;
    }
    // Flatten nested Offer / Brand blocks one level under this item (common for Product).
    const parentScope = scope?.parentElement?.closest('[itemscope]');
    if (parentScope === root && scope) {
      const parentProp = scope.getAttribute('itemprop');
      if (parentProp === 'offers' || parentProp === 'brand' || parentProp === 'address') {
        add(prop, readProp(el));
        if (prop === 'name' && parentProp === 'brand') add('brand', readProp(el));
      }
    }
  }
  return map;
}

function first(map: Map<string, string[]>, key: string): string | undefined {
  return map.get(key)?.[0];
}

function asNumber(raw: string | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^0-9.-]/g, '');
  if (!cleaned) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

function itemFromScope(root: Element, pageUrl: URL, index: number): ExtractedItem | null {
  const kind = kindFromItemtype(root.getAttribute('itemtype'));
  if (!kind) return null;
  const props = propertyMap(root);
  const name = first(props, 'name') ?? first(props, 'title');
  if (!name) return null;
  const sourceUrl = (() => {
    const href = first(props, 'url');
    if (!href) return pageUrl.href;
    try {
      return new URL(href, pageUrl).href;
    } catch {
      return pageUrl.href;
    }
  })();

  const fields: Record<string, ProvenancedValue> = {};
  const priceRaw = first(props, 'price');
  const price = asNumber(priceRaw);
  if (price !== null) fields.price = provenanced(price, sourceUrl, priceRaw);
  const currency = first(props, 'priceCurrency');
  if (currency) fields.currency = provenanced(currency.toUpperCase(), sourceUrl, currency);
  const availability = first(props, 'availability');
  if (availability) fields.availability = provenanced(availability, sourceUrl, availability);
  const brand = first(props, 'brand');
  if (brand) fields.brand = provenanced(brand, sourceUrl, brand);
  const company = first(props, 'hiringOrganization') ?? first(props, 'employer');
  if (company) fields.company = provenanced(company, sourceUrl, company);
  const location = first(props, 'jobLocation') ?? first(props, 'address');
  if (location) fields.location = provenanced(location, sourceUrl, location);
  const bedrooms = asNumber(first(props, 'numberOfBedrooms') ?? first(props, 'bedrooms'));
  if (bedrooms !== null) fields.bedrooms = provenanced(bedrooms, sourceUrl);
  const bathrooms = asNumber(first(props, 'numberOfBathroomsTotal') ?? first(props, 'bathrooms'));
  if (bathrooms !== null) fields.bathrooms = provenanced(bathrooms, sourceUrl);

  return ExtractedItemSchema.parse({
    id: `microdata-${kind}-${index}`,
    kind,
    name: provenanced(name, sourceUrl, name),
    url: sourceUrl,
    fields,
    adapterId: 'microdata',
  });
}

export const microdataAdapter: SourceAdapter = {
  id: 'microdata',
  matches(_url, doc) {
    return doc.querySelector('[itemscope][itemtype]') !== null;
  },
  extractItems(doc, url) {
    const items: ExtractedItem[] = [];
    const scopes = [...doc.querySelectorAll('[itemscope][itemtype]')];
    scopes.forEach((scope, index) => {
      // Prefer top-level scopes; nested offer blocks are merged via propertyMap on the parent.
      if (scope.parentElement?.closest('[itemscope]')) return;
      const item = itemFromScope(scope, url, index);
      if (item) items.push(item);
    });
    return items;
  },
};
