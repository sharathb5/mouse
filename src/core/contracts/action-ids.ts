/**
 * Action id constants with no Zod runtime dependency. Content-script hot path imports
 * from here so evaluating the module does not pull in the contracts schema graph.
 */
export const ACTION_IDS = [
  'explain',
  'select-content',
  'send-to-agent',
  'summarize',
  'translate',
  'ask-follow-up',
  'simplify',
  'go-deeper',
  'example',
  'compare',
  'extract',
  'track',
] as const;

export type ActionId = (typeof ACTION_IDS)[number];

export function isActionId(value: string): value is ActionId {
  return (ACTION_IDS as readonly string[]).includes(value);
}
