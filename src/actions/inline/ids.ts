export const INLINE_ACTION_IDS = [
  'explain',
  'summarize',
  'translate',
  'ask-follow-up',
  'simplify',
  'go-deeper',
  'example',
] as const;

export type InlineActionId = (typeof INLINE_ACTION_IDS)[number];
