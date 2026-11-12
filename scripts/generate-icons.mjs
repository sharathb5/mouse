// Rasterizes assets/icon.svg into the PNG sizes Chrome expects (public/icon/<size>.png).
// Usage: node scripts/generate-icons.mjs (requires `pnpm exec playwright install chromium`).
import { readFile, mkdir } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const SIZES = [16, 32, 48, 128];
const svg = await readFile(new URL('../assets/icon.svg', import.meta.url), 'utf8');
const outDir = new URL('../public/icon/', import.meta.url);
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
try {
  for (const size of SIZES) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(
      `<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
    );
    await page.screenshot({ path: new URL(`${size}.png`, outDir).pathname, omitBackground: true });
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(`Wrote ${SIZES.map((s) => `${s}.png`).join(', ')} to public/icon/`);
