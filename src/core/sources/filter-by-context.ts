import type { ExtractedItem, SelectedContext } from '../contracts';

/** Plain text drawn from the selection target for matching structured items. */
export function selectedContextHaystack(context: SelectedContext): string {
  switch (context.target.kind) {
    case 'text-selection':
      return context.target.text;
    case 'element':
      return context.target.text;
    case 'link':
      return context.target.text;
    case 'image':
      return context.target.alt;
    case 'page':
      return '';
  }
}

/**
 * When the user outlined a specific selection, prefer ExtractedItems whose name
 * appears in that selection. Falls back to the full list when nothing matches
 * (e.g. JSON-LD-only pages where the outline text does not echo product names).
 */
export function filterItemsBySelectedContext(
  items: readonly ExtractedItem[],
  context: SelectedContext,
): ExtractedItem[] {
  if (items.length === 0 || context.target.kind === 'page') {
    return [...items];
  }
  const haystack = selectedContextHaystack(context).toLowerCase().replace(/\s+/g, ' ').trim();
  if (haystack.length < 2) return [...items];

  const matched = items.filter((item) => {
    const name = String(item.name.value).toLowerCase().replace(/\s+/g, ' ').trim();
    if (!name) return false;
    return haystack.includes(name) || name.includes(haystack) || tokensOverlap(haystack, name);
  });
  return matched.length > 0 ? matched : [...items];
}

function tokensOverlap(haystack: string, name: string): boolean {
  const nameTokens = name.split(' ').filter((token) => token.length > 2);
  if (nameTokens.length === 0) return false;
  const hits = nameTokens.filter((token) => haystack.includes(token));
  return hits.length >= Math.min(2, nameTokens.length);
}
