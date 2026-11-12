import type { Money, TrackCondition, TrackerSnapshot } from '../contracts';

function sameMoney(a: Money | undefined, b: Money | undefined): boolean {
  if (!a || !b) return a === b;
  return a.amount === b.amount && a.currency === b.currency;
}

/**
 * Returns true when the track condition is satisfied by comparing previous and current
 * snapshots. Missing prices/availability never invent a hit.
 */
export function evaluateCondition(
  condition: TrackCondition,
  previous: TrackerSnapshot | undefined,
  current: TrackerSnapshot,
): boolean {
  switch (condition.kind) {
    case 'price-below': {
      const price = current.price;
      if (!price) return false;
      return (
        price.currency === condition.threshold.currency && price.amount < condition.threshold.amount
      );
    }
    case 'price-change': {
      if (!previous?.price || !current.price) return false;
      return !sameMoney(previous.price, current.price);
    }
    case 'availability-change': {
      if (!previous?.availability || !current.availability) return false;
      return previous.availability !== current.availability;
    }
    case 'content-change': {
      const hint = condition.selectorHint;
      if (hint) {
        const prev = previous?.fields[hint]?.value ?? null;
        const next = current.fields[hint]?.value ?? null;
        return prev !== next;
      }
      const prevJson = JSON.stringify(previous?.fields ?? {});
      const nextJson = JSON.stringify(current.fields);
      return prevJson !== nextJson;
    }
  }
}
