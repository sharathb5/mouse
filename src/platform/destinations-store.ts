import { storage } from 'wxt/utils/storage';
import {
  DestinationsConfigSchema,
  parseDestinationsConfig,
  type DestinationsConfig,
} from '@/core/contracts';

export const DESTINATIONS_STORAGE_KEY = 'local:destinations';

const destinationsItem = storage.defineItem<unknown>(DESTINATIONS_STORAGE_KEY, { fallback: null });

export async function loadDestinationsConfig(): Promise<DestinationsConfig> {
  return parseDestinationsConfig(await destinationsItem.getValue());
}

export async function saveDestinationsConfig(
  config: DestinationsConfig,
): Promise<DestinationsConfig> {
  const valid = DestinationsConfigSchema.parse(config);
  await destinationsItem.setValue(valid);
  return valid;
}

export function watchDestinationsConfig(
  onChange: (config: DestinationsConfig) => void,
): () => void {
  return destinationsItem.watch((value) => onChange(parseDestinationsConfig(value)));
}
