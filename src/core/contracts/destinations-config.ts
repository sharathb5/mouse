import { z } from 'zod';
import { AgentDestinationSchema } from './destination';

export const DESTINATIONS_CONFIG_VERSION = 1;

/** Reusable Send-to-Agent shortcut: destination + instruction template. */
export const SavedActionSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(80),
  destinationId: z.string().min(1),
  /** May include `{selection}` and `{url}` placeholders; page text stays untrusted data. */
  instructionTemplate: z.string().max(4000).default(''),
  createdAt: z.iso.datetime(),
});
export type SavedAction = z.infer<typeof SavedActionSchema>;

/**
 * Revocable site ↔ agent trust. Matching origin + destination skips the explicit
 * approval dialog for Send to Agent.
 */
export const TrustedRuleSchema = z.object({
  id: z.string().min(1).max(64),
  /** Origin pattern, e.g. `https://github.com` (exact origin match for V1). */
  originPattern: z.string().min(1).max(200),
  destinationId: z.string().min(1),
  createdAt: z.iso.datetime(),
  revokedAt: z.iso.datetime().optional(),
});
export type TrustedRule = z.infer<typeof TrustedRuleSchema>;

export const DEFAULT_DESTINATIONS: z.infer<typeof AgentDestinationSchema>[] = [
  {
    id: 'cursor-default',
    label: 'Cursor Cloud Agent',
    isDefault: true,
    integration: 'cursor-cloud-agent',
    capability: 'background-execution',
    repository: 'github.com/sharathb5/mouse',
    ref: 'main',
  },
  {
    id: 'chatgpt-prefill',
    label: 'ChatGPT (prefill)',
    isDefault: false,
    integration: 'prefill-link',
    capability: 'prefill-only',
    provider: 'chatgpt',
    urlTemplate: 'https://chatgpt.com/?q={prompt}',
  },
  {
    id: 'clipboard',
    label: 'Copy prompt',
    isDefault: false,
    integration: 'clipboard',
    capability: 'copy-only',
  },
];

export const DestinationsConfigSchema = z.object({
  version: z.literal(DESTINATIONS_CONFIG_VERSION),
  destinations: z.array(AgentDestinationSchema).min(1),
  savedActions: z.array(SavedActionSchema).max(50),
  trustedRules: z.array(TrustedRuleSchema).max(100),
});
export type DestinationsConfig = z.infer<typeof DestinationsConfigSchema>;

export const DEFAULT_DESTINATIONS_CONFIG: DestinationsConfig = {
  version: DESTINATIONS_CONFIG_VERSION,
  destinations: structuredClone(DEFAULT_DESTINATIONS),
  savedActions: [],
  trustedRules: [],
};

export function parseDestinationsConfig(raw: unknown): DestinationsConfig {
  const full = DestinationsConfigSchema.safeParse(raw);
  if (full.success) return ensureSingleDefault(full.data);

  if (typeof raw !== 'object' || raw === null) {
    return structuredClone(DEFAULT_DESTINATIONS_CONFIG);
  }
  const record = raw as Record<string, unknown>;
  const destinations = z.array(AgentDestinationSchema).safeParse(record.destinations);
  const savedActions = z.array(SavedActionSchema).safeParse(record.savedActions);
  const trustedRules = z.array(TrustedRuleSchema).safeParse(record.trustedRules);
  return ensureSingleDefault({
    version: DESTINATIONS_CONFIG_VERSION,
    destinations: destinations.success ? destinations.data : structuredClone(DEFAULT_DESTINATIONS),
    savedActions: savedActions.success ? savedActions.data : [],
    trustedRules: trustedRules.success ? trustedRules.data : [],
  });
}

/** Exactly one destination is marked default; prefer the first flagged, else the first entry. */
export function ensureSingleDefault(config: DestinationsConfig): DestinationsConfig {
  const destinations = config.destinations.map((d) => ({ ...d, isDefault: false }));
  const preferred = config.destinations.find((d) => d.isDefault)?.id ?? destinations[0]?.id ?? null;
  return {
    ...config,
    destinations: destinations.map((d) => (d.id === preferred ? { ...d, isDefault: true } : d)),
  };
}

export function findActiveTrustedRule(
  rules: readonly TrustedRule[],
  origin: string,
  destinationId: string,
): TrustedRule | undefined {
  return rules.find(
    (rule) =>
      rule.revokedAt === undefined &&
      rule.destinationId === destinationId &&
      originsMatch(rule.originPattern, origin),
  );
}

function originsMatch(pattern: string, origin: string): boolean {
  try {
    return new URL(pattern).origin === new URL(origin).origin;
  } catch {
    return pattern === origin;
  }
}
