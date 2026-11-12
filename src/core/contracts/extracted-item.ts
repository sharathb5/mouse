import { z } from 'zod';

/** A single extracted field that always traces back to a concrete page URL. */
export const ProvenancedValueSchema = z.object({
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
  sourceUrl: z.url(),
  /** Original text as scraped, before normalization. */
  raw: z.string().optional(),
});
export type ProvenancedValue = z.infer<typeof ProvenancedValueSchema>;

export const ExtractedItemKindSchema = z.enum([
  'product',
  'offer',
  'job',
  'residence',
  'listing-item',
  'other',
]);
export type ExtractedItemKind = z.infer<typeof ExtractedItemKindSchema>;

/**
 * One grounded entity from a page. Missing attributes are omitted or set to null —
 * adapters must never invent values.
 */
export const ExtractedItemSchema = z.object({
  id: z.string().min(1),
  kind: ExtractedItemKindSchema,
  name: ProvenancedValueSchema,
  url: z.url().optional(),
  fields: z.record(z.string(), ProvenancedValueSchema),
  adapterId: z.string().min(1),
});
export type ExtractedItem = z.infer<typeof ExtractedItemSchema>;
