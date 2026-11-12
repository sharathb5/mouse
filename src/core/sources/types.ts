import type { ExtractedItem } from '../contracts';

/**
 * Pure page → structured items adapter. Implementations must only emit values found on the
 * page (or clearly null). Every field carries its source URL.
 */
export interface SourceAdapter {
  readonly id: string;
  matches(url: URL, doc: Document): boolean;
  extractItems(doc: Document, url: URL): ExtractedItem[];
}
