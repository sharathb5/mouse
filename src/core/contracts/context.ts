import { z } from 'zod';
import { ElementClassificationSchema, PageClassificationSchema } from './classification';

/** Structure-preserving extracted content. Workstream A produces these blocks. */
export const ContentBlockSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('heading'),
    level: z.number().int().min(1).max(6),
    text: z.string(),
  }),
  z.object({ type: z.literal('paragraph'), text: z.string() }),
  z.object({
    type: z.literal('list'),
    ordered: z.boolean(),
    items: z.array(z.string()),
  }),
  z.object({
    type: z.literal('table'),
    headers: z.array(z.string()),
    rows: z.array(z.array(z.string())),
    caption: z.string().optional(),
  }),
  z.object({
    type: z.literal('code'),
    language: z.string().optional(),
    text: z.string(),
  }),
  z.object({ type: z.literal('quote'), text: z.string() }),
  z.object({ type: z.literal('image'), src: z.url(), alt: z.string() }),
  z.object({ type: z.literal('link'), href: z.url(), text: z.string() }),
]);
export type ContentBlock = z.infer<typeof ContentBlockSchema>;

export const SourceMetadataSchema = z.object({
  url: z.url(),
  title: z.string().max(1000),
  /** BCP 47 language tag from `<html lang>` when present. */
  language: z.string().optional(),
  capturedAt: z.iso.datetime(),
  frame: z.enum(['top', 'subframe']),
});
export type SourceMetadata = z.infer<typeof SourceMetadataSchema>;

/** What the user pointed at, at the granularity it was selected. */
export const SelectionTargetSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('text-selection'),
    text: z.string().min(1),
    blocks: z.array(ContentBlockSchema),
  }),
  z.object({
    kind: z.literal('element'),
    element: ElementClassificationSchema,
    text: z.string(),
    blocks: z.array(ContentBlockSchema),
  }),
  z.object({
    kind: z.literal('page'),
    blocks: z.array(ContentBlockSchema),
  }),
  z.object({ kind: z.literal('link'), href: z.url(), text: z.string() }),
  z.object({ kind: z.literal('image'), src: z.url(), alt: z.string() }),
]);
export type SelectionTarget = z.infer<typeof SelectionTargetSchema>;
export type SelectionTargetKind = SelectionTarget['kind'];

/**
 * The context an action operates on. Everything inside originates from the webpage and
 * is untrusted data: it must be quoted/delimited when sent to a model and must never be
 * interpreted as instructions that override the user's chosen action.
 */
export const SelectedContextSchema = z.object({
  untrusted: z.literal(true),
  source: SourceMetadataSchema,
  target: SelectionTargetSchema,
  page: PageClassificationSchema,
  /** Set when the selection touched sensitive fields; such contexts must not be sent externally. */
  containsSensitiveData: z.boolean(),
});
export type SelectedContext = z.infer<typeof SelectedContextSchema>;
