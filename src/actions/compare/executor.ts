import type { ActionExecutor } from '@/core/actions';
import type {
  ActionEvent,
  ActionResult,
  Column,
  ExtractedItem,
  ProvenancedValue,
} from '@/core/contracts';
import { parseMoney } from '@/core/normalize';
import {
  extractFromDocument,
  filterItemsBySelectedContext,
  type SourceAdapter,
} from '@/core/sources';
import { EmptyAlternativesProvider, type AlternativesProvider } from './alternatives';

export interface CompareExecutorDeps {
  getDocument: () => Document;
  getPageUrl?: () => string;
  adapters?: readonly SourceAdapter[];
  alternatives?: AlternativesProvider;
  /** Optional: fetch HTML for candidate URLs. MOCK paths should label themselves. */
  fetchDocument?: (url: string, signal: AbortSignal) => Promise<Document | null>;
}

type Cell = string | number | boolean | null;

function cellValue(field: ProvenancedValue | undefined): Cell {
  return field ? field.value : null;
}

function priceNumber(item: ExtractedItem): number | null {
  const field = item.fields.price;
  if (!field) return null;
  if (typeof field.value === 'number') return field.value;
  if (typeof field.value === 'string' || field.raw) {
    return (
      parseMoney(
        field.raw ?? String(field.value),
        typeof item.fields.currency?.value === 'string' ? item.fields.currency.value : null,
      )?.amount ?? null
    );
  }
  return null;
}

function buildSummary(items: ExtractedItem[], attributes: Column[]): string {
  const facts: string[] = [];
  facts.push(`Compared ${items.length} items.`);
  if (attributes.some((column) => column.key === 'price')) {
    const priced = items
      .map((item) => ({ name: String(item.name.value), price: priceNumber(item) }))
      .filter((entry): entry is { name: string; price: number } => entry.price !== null);
    if (priced.length >= 2) {
      const sorted = [...priced].sort((a, b) => a.price - b.price);
      const cheapest = sorted[0];
      const dearest = sorted[sorted.length - 1];
      if (cheapest && dearest) {
        facts.push(
          `${cheapest.name} has the lowest listed price (${cheapest.price}); ${dearest.name} has the highest (${dearest.price}).`,
        );
      }
    } else if (priced.length === 1) {
      const only = priced[0];
      if (only) facts.push(`${only.name} lists a price of ${only.price}.`);
    }
  }
  for (const item of items) {
    const availability = item.fields.availability?.value;
    if (typeof availability === 'string') {
      facts.push(`${String(item.name.value)} availability: ${availability}.`);
    }
  }
  return facts.join(' ');
}

function attributeColumns(items: ExtractedItem[]): Column[] {
  const keys = new Set<string>();
  for (const item of items) {
    for (const key of Object.keys(item.fields)) keys.add(key);
  }
  const preferred = ['price', 'currency', 'availability', 'brand', 'company', 'location', 'salary'];
  const ordered = [
    ...preferred.filter((key) => keys.has(key)),
    ...[...keys].filter((key) => !preferred.includes(key)).sort(),
  ];
  return ordered.map((key) => ({
    key,
    label: key.charAt(0).toUpperCase() + key.slice(1),
    type:
      key === 'price' || key === 'salary'
        ? 'currency'
        : key === 'url'
          ? 'url'
          : key === 'availability'
            ? 'text'
            : typeof items.find((item) => item.fields[key])?.fields[key]?.value === 'number'
              ? 'number'
              : 'text',
  }));
}

export function createCompareExecutor(deps: CompareExecutorDeps): ActionExecutor<'compare'> {
  const alternatives = deps.alternatives ?? new EmptyAlternativesProvider();

  return {
    actionId: 'compare',
    async *execute(input, signal): AsyncIterable<ActionEvent> {
      if (input.context.containsSensitiveData) {
        yield {
          type: 'error',
          error: {
            code: 'sensitive-content',
            message: 'Compare will not process sensitive fields.',
            retryable: false,
          },
        };
        return;
      }

      yield {
        type: 'progress',
        progress: { mode: 'indeterminate', label: 'Collecting comparable items' },
      };

      const pageUrl = deps.getPageUrl?.() ?? input.context.source.url;
      const extracted = extractFromDocument(deps.getDocument(), pageUrl, deps.adapters);
      const scoped = filterItemsBySelectedContext(extracted, input.context);
      // Compare needs ≥2 items; keep the full page set when the outline narrows too far.
      const localItems = scoped.length >= 2 ? scoped : extracted;
      const items: ExtractedItem[] = [...localItems];

      for (const candidateUrl of input.candidateUrls) {
        if (signal.aborted) break;
        if (!deps.fetchDocument) continue;
        const doc = await deps.fetchDocument(candidateUrl, signal);
        if (!doc) continue;
        items.push(...extractFromDocument(doc, candidateUrl, deps.adapters));
      }

      const seed = items[0];
      if (seed) {
        try {
          const found = await alternatives.find(seed, signal);
          items.push(...found);
        } catch (error) {
          if (signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
            yield {
              type: 'error',
              error: { code: 'cancelled', message: 'Compare cancelled.', retryable: false },
            };
            return;
          }
          // Alternatives are best-effort; local items can still form a comparison.
        }
      }

      // De-dupe by URL + name.
      const unique: ExtractedItem[] = [];
      const seen = new Set<string>();
      for (const item of items) {
        const key = `${item.url ?? ''}|${String(item.name.value).toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(item);
      }

      if (unique.length < 2) {
        yield {
          type: 'result',
          result: {
            kind: 'unavailable',
            actionId: 'compare',
            reason:
              'Need at least two grounded items to compare. Pin more products on the page, pass candidate URLs, or configure an AlternativesProvider.',
          },
        };
        return;
      }

      const attributes = attributeColumns(unique);
      const comparisonItems = unique.map((item) => {
        const values: Record<string, Cell> = {};
        for (const column of attributes) {
          values[column.key] =
            column.key === 'price' ? priceNumber(item) : cellValue(item.fields[column.key]);
        }
        return {
          name: String(item.name.value),
          url: item.url ?? item.name.sourceUrl,
          values,
        };
      });

      const sources = [
        ...new Set(
          unique.flatMap((item) => [
            item.name.sourceUrl,
            ...(item.url ? [item.url] : []),
            ...Object.values(item.fields).map((field) => field.sourceUrl),
          ]),
        ),
      ];

      const result: Extract<ActionResult, { kind: 'comparison' }> = {
        kind: 'comparison',
        attributes,
        items: comparisonItems,
        summary: buildSummary(unique, attributes),
        sources,
      };
      yield { type: 'result', result };
    },
  };
}

export type { AlternativesProvider } from './alternatives';
export { EmptyAlternativesProvider, StaticAlternativesProvider } from './alternatives';
