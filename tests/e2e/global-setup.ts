import { existsSync } from 'node:fs';
import { EXTENSION_PATH } from './extension';

export default function globalSetup() {
  if (!existsSync(`${EXTENSION_PATH}/manifest.json`)) {
    throw new Error(
      `No built extension at ${EXTENSION_PATH}. Run \`pnpm build\` before \`pnpm test:e2e\`.`,
    );
  }
}
