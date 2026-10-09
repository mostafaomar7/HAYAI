import { defineConfig } from '@playwright/test';

/**
 * Tracking tests — section 9 of the Measurement & Tracking Specification.
 *
 * Run against the built SSR server (`node dist/BAREEQ/server/server.mjs`),
 * never a dev build: what is measured is what the server renders.
 *
 *   BASE_URL   the running site            (default http://localhost:4000)
 *   PW_CHANNEL a locally installed browser, e.g. `chrome`, instead of the
 *              Chromium Playwright downloads (CI uses the download).
 */
export default defineConfig({
  testDir: 'tests/tracking',
  timeout: 45_000,
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['github'], ['list']] : 'list',
  use: {
    baseURL: process.env['BASE_URL'] || 'http://localhost:4000',
    channel: process.env['PW_CHANNEL'] || undefined,
    locale: 'ar-EG'
  }
});
