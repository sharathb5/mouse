import { resolve } from 'node:path';
import { build, mergeConfig, type InlineConfig } from 'vite';
import { defineWxtModule } from 'wxt/modules';
import type { ContentScriptEntrypoint } from 'wxt';

/**
 * Builds the content-script app as ESM with code-splitting enabled, then exposes the
 * chunks via web_accessible_resources. The WXT content entrypoint is only a tiny loader
 * that dynamically imports `/content-scripts/esm/content.js`.
 *
 * Pattern adapted from https://github.com/wxt-dev/examples/tree/main/examples/esm-content-script-ui
 */
export default defineWxtModule((wxt) => {
  let baseViteConfig: InlineConfig = {};
  let contentScriptEntrypoint: ContentScriptEntrypoint | undefined;

  wxt.hooks.hook('vite:build:extendConfig', (entrypoints, config) => {
    if (entrypoints.some((entrypoint) => entrypoint.name === 'content')) {
      baseViteConfig = config;
    }
  });

  wxt.hooks.hook('entrypoints:resolved', (_wxt, entrypoints) => {
    contentScriptEntrypoint = entrypoints.find((entry) => entry.name === 'content') as
      ContentScriptEntrypoint | undefined;
  });

  const buildEsmContentScript = async () => {
    wxt.logger.info('[esm-content] Building content-scripts/esm…');
    const entry = resolve(wxt.config.entrypointsDir, 'content/esm-index.ts');
    const outDir = resolve(wxt.config.outDir, 'content-scripts/esm');

    // Start from the content entry's Vite config (aliases, WXT plugins, `browser` shim),
    // then force ESM + code splitting. The IIFE content build sets codeSplitting: false.
    const esmConfig: InlineConfig = {
      build: {
        emptyOutDir: true,
        outDir,
        minify: true,
        cssCodeSplit: false,
        lib: {
          entry,
          formats: ['es'],
          fileName: () => 'content.js',
        },
        rollupOptions: {
          output: {
            format: 'es',
            codeSplitting: true,
            inlineDynamicImports: false,
            entryFileNames: 'content.js',
            chunkFileNames: 'chunks/[name]-[hash].js',
            assetFileNames: '[name][extname]',
          },
        },
      },
    };

    const finalConfig = mergeConfig(baseViteConfig, esmConfig);
    // mergeConfig can leave IIFE leftovers; stamp ESM splitting again after merge.
    finalConfig.build ??= {};
    finalConfig.build.rollupOptions ??= {};
    const output = finalConfig.build.rollupOptions.output;
    if (Array.isArray(output)) {
      for (const item of output) {
        item.format = 'es';
        item.codeSplitting = true;
        item.inlineDynamicImports = false;
        item.entryFileNames = 'content.js';
        item.chunkFileNames = 'chunks/[name]-[hash].js';
      }
    } else if (output && typeof output === 'object') {
      output.format = 'es';
      output.codeSplitting = true;
      output.inlineDynamicImports = false;
      output.entryFileNames = 'content.js';
      output.chunkFileNames = 'chunks/[name]-[hash].js';
    }

    await build(finalConfig);
    wxt.logger.success('[esm-content] Done');
  };

  wxt.hooks.hook('build:done', () => buildEsmContentScript());

  wxt.hooks.hookOnce('build:done', () => {
    const ignored = new Set([
      resolve(wxt.config.entrypointsDir, 'content/index.tsx'),
      resolve(wxt.config.entrypointsDir, 'content/index.ts'),
    ]);
    wxt.server?.watcher.on('all', async (_event, file) => {
      if (!file.startsWith(resolve(wxt.config.srcDir)) || ignored.has(file)) return;
      if (
        file.includes(`${resolve(wxt.config.srcDir, 'content')}`) ||
        file.includes(`${resolve(wxt.config.srcDir, 'actions')}`) ||
        file.includes(`${resolve(wxt.config.srcDir, 'core')}`) ||
        file.includes(`${resolve(wxt.config.srcDir, 'platform')}`)
      ) {
        await buildEsmContentScript();
        if (contentScriptEntrypoint) {
          wxt.server?.reloadContentScript({
            contentScript: {
              matches: contentScriptEntrypoint.options.matches,
              js: ['/content-scripts/content.js'],
            },
          });
        }
        wxt.logger.success('[esm-content] Reloaded content after ESM change');
      }
    });
  });

  wxt.hooks.hook('build:manifestGenerated', (_wxt, manifest) => {
    const matches = contentScriptEntrypoint?.options.matches;
    if (!matches?.length) return;
    const resources = manifest.web_accessible_resources ?? [];
    // @ts-expect-error MV2/MV3 WAR typings conflict in @types/chrome; MV3 shape is correct.
    resources.push({
      matches,
      resources: ['/content-scripts/esm/*', '/content-scripts/esm/chunks/*'],
    });
    manifest.web_accessible_resources = resources;
  });

  wxt.hooks.hook('prepare:publicPaths', (_wxt, paths) => {
    paths.push('content-scripts/esm/content.js');
  });
});
