import type { ActionId } from '@/core/contracts';

const BASE_SYSTEM =
  'You are Agentic Mouse, a browser assistant. Answer clearly and concisely in Markdown. ' +
  'Ground your answer in the provided webpage content. If the content is insufficient, say so.';

export function systemPromptFor(actionId: ActionId): string {
  return `${BASE_SYSTEM} Action: ${actionId}.`;
}

export function userInstructionFor(
  actionId: ActionId,
  options: Record<string, unknown> = {},
): string {
  switch (actionId) {
    case 'explain':
      return 'Explain this content in plain language.';
    case 'summarize': {
      const length = typeof options.length === 'string' ? options.length : 'standard';
      return `Summarize this content (${length} length).`;
    }
    case 'translate': {
      const lang = typeof options.targetLanguage === 'string' ? options.targetLanguage : 'en';
      return `Translate this content into ${lang}. Preserve meaning; keep proper nouns.`;
    }
    case 'ask-follow-up': {
      const question =
        typeof options.question === 'string' && options.question.trim()
          ? options.question.trim()
          : 'What is the key takeaway?';
      return `Answer this follow-up question about the content:\n${question}`;
    }
    case 'simplify': {
      const level = typeof options.readingLevel === 'string' ? options.readingLevel : 'general';
      return `Rewrite this content more simply for a ${level} reader.`;
    }
    case 'go-deeper':
      return 'Give a deeper explanation with useful background and nuance.';
    case 'example':
      return 'Give a concrete, practical example that illustrates this content.';
    case 'select-content':
    case 'send-to-agent':
    case 'compare':
    case 'extract':
    case 'track':
      return 'Describe this content.';
  }
}

export function purposeFor(
  actionId: ActionId,
):
  | 'explanation'
  | 'summary'
  | 'translation'
  | 'answer'
  | 'simplification'
  | 'deep-dive'
  | 'example' {
  switch (actionId) {
    case 'explain':
      return 'explanation';
    case 'summarize':
      return 'summary';
    case 'translate':
      return 'translation';
    case 'ask-follow-up':
      return 'answer';
    case 'simplify':
      return 'simplification';
    case 'go-deeper':
      return 'deep-dive';
    case 'example':
      return 'example';
    case 'select-content':
    case 'send-to-agent':
    case 'compare':
    case 'extract':
    case 'track':
      return 'explanation';
  }
}
