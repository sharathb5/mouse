import { z } from 'zod';

/** 0..1 confidence produced by local heuristics. Never by an LLM in the menu-open path. */
export const ConfidenceSchema = z.number().min(0).max(1);

/** Human-readable heuristic signals, e.g. `"og:type=product"` or `"<article> element"`. */
export const SignalsSchema = z.array(z.string().min(1)).max(32);

export const MoneySchema = z.object({
  amount: z.number().nonnegative(),
  currency: z.string().length(3),
});
export type Money = z.infer<typeof MoneySchema>;

const pageBase = {
  confidence: ConfidenceSchema,
  signals: SignalsSchema,
};

/**
 * Page classification. Changes how actions interpret context; it must never change
 * which actions appear in the pinned menu.
 */
export const PageClassificationSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('article'), ...pageBase }),
  z.object({ kind: z.literal('documentation'), ...pageBase }),
  z.object({
    kind: z.literal('github-issue'),
    ...pageBase,
    repository: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
    issueNumber: z.number().int().positive(),
    isPullRequest: z.boolean(),
  }),
  z.object({
    kind: z.literal('product'),
    ...pageBase,
    price: MoneySchema.optional(),
    availability: z.enum(['in-stock', 'out-of-stock', 'preorder', 'unknown']).optional(),
  }),
  z.object({
    kind: z.literal('listing'),
    ...pageBase,
    listingType: z.enum(['apartment', 'job', 'product', 'other']),
    itemCount: z.number().int().nonnegative().optional(),
  }),
  z.object({ kind: z.literal('generic'), ...pageBase }),
]);
export type PageClassification = z.infer<typeof PageClassificationSchema>;
export type PageKind = PageClassification['kind'];

export const ELEMENT_KINDS = [
  'paragraph',
  'heading',
  'section',
  'article',
  'table',
  'list',
  'code',
  'quote',
  'link',
  'image',
  'form-field',
  'unknown',
] as const;
export const ElementKindSchema = z.enum(ELEMENT_KINDS);
export type ElementKind = z.infer<typeof ElementKindSchema>;

export const ElementClassificationSchema = z.object({
  kind: ElementKindSchema,
  confidence: ConfidenceSchema,
  signals: SignalsSchema,
  /** True for password/credit-card/OTP-like fields. Such content must never leave the device. */
  sensitive: z.boolean(),
});
export type ElementClassification = z.infer<typeof ElementClassificationSchema>;

export const UNCLASSIFIED_PAGE: PageClassification = {
  kind: 'generic',
  confidence: 0,
  signals: [],
};
