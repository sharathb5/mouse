import type { ActionInputFor, SelectedContext, TrackCondition } from '@/core/contracts';
import { snapshotFromDocument } from '@/core/tracking';

/**
 * Builds a Track input from the live page. Prefers price-below at 95% of the current price so
 * a later simulated drop can satisfy the condition in tests; falls back to availability-change.
 */
export function buildTrackInput(context: SelectedContext, doc: Document): ActionInputFor<'track'> {
  const snapshot = snapshotFromDocument(doc, context.source.url);
  let condition: TrackCondition = { kind: 'availability-change' };

  if (snapshot?.price) {
    condition = {
      kind: 'price-below',
      threshold: {
        amount: Number((snapshot.price.amount * 0.95).toFixed(2)),
        currency: snapshot.price.currency,
      },
    };
  } else if (context.page.kind === 'product' && context.page.price) {
    condition = {
      kind: 'price-below',
      threshold: {
        amount: Number((context.page.price.amount * 0.95).toFixed(2)),
        currency: context.page.price.currency,
      },
    };
  }

  return { actionId: 'track', context, condition };
}
