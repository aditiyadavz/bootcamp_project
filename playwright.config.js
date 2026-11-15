// Browser tests. They start the test server (temporary database) automatically. Run: npm run test:e2e
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:5100',
    // On a laptop the installed Microsoft Edge is used. GitHub Actions uses Playwright's own Chromium.
    channel: process.env.CI ? undefined : 'msedge',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node server/tests/e2e-server.js',
    url: 'http://localhost:5100/api/health',
    reuseExistingServer: !process.env.CI,
    timeout: 180000,
  },
});
