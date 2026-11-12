import type { ActionDefinition, ActionId } from '../contracts';

/**
 * The supported action library. Adding an action means adding a definition here (plus its
 * input variant in contracts/action.ts) and, when it works, registering an executor.
 * The context menu renders whatever the registry resolves; it never hard-codes actions.
 */
export const ACTION_CATALOG = {
  explain: {
    id: 'explain',
    label: 'Explain This',
    description: 'Explain the selected content in plain language.',
    category: 'understand',
    dataEgress: 'on-invoke',
    presentation: 'inline-panel',
  },
  'select-content': {
    id: 'select-content',
    label: 'Select Content',
    description: 'Select the meaningful content block under the cursor.',
    category: 'select',
    dataEgress: 'none',
    presentation: 'selection',
  },
  'send-to-agent': {
    id: 'send-to-agent',
    label: 'Send to Agent',
    description: 'Hand the selected content to an external agent with its source context.',
    category: 'delegate',
    dataEgress: 'requires-approval',
    presentation: 'task',
  },
  summarize: {
    id: 'summarize',
    label: 'Summarize',
    description: 'Summarize the selected content.',
    category: 'understand',
    dataEgress: 'on-invoke',
    presentation: 'inline-panel',
  },
  translate: {
    id: 'translate',
    label: 'Translate',
    description: 'Translate the selected content.',
    category: 'understand',
    dataEgress: 'on-invoke',
    presentation: 'inline-panel',
  },
  'ask-follow-up': {
    id: 'ask-follow-up',
    label: 'Ask Follow-up',
    description: 'Ask a question about the selected content.',
    category: 'understand',
    dataEgress: 'on-invoke',
    presentation: 'inline-panel',
  },
  simplify: {
    id: 'simplify',
    label: 'Simplify',
    description: 'Rewrite the selected content more simply.',
    category: 'understand',
    dataEgress: 'on-invoke',
    presentation: 'inline-panel',
  },
  'go-deeper': {
    id: 'go-deeper',
    label: 'Go Deeper',
    description: 'Get a more detailed explanation with background.',
    category: 'understand',
    dataEgress: 'on-invoke',
    presentation: 'inline-panel',
  },
  example: {
    id: 'example',
    label: 'Example',
    description: 'Show a concrete example of the selected concept.',
    category: 'understand',
    dataEgress: 'on-invoke',
    presentation: 'inline-panel',
  },
  compare: {
    id: 'compare',
    label: 'Compare',
    description: 'Compare products or listings with grounded, sourced attributes.',
    category: 'real-world',
    dataEgress: 'on-invoke',
    presentation: 'task',
  },
  extract: {
    id: 'extract',
    label: 'Extract',
    description: 'Turn repeated page content into a structured table.',
    category: 'real-world',
    dataEgress: 'none',
    presentation: 'inline-panel',
  },
  track: {
    id: 'track',
    label: 'Track',
    description: 'Watch for price, availability, or status changes.',
    category: 'real-world',
    dataEgress: 'none',
    presentation: 'task',
  },
} as const satisfies { readonly [K in ActionId]: ActionDefinition & { id: K } };
