import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: ['**/*.spec.ts'],
  outputDir: '/tmp/playwright-results',
  timeout: 90000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['line']],
  use: {
    baseURL: 'http://localhost:8082',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    navigationTimeout: 15000,
    actionTimeout: 10000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 400, height: 720 } },
    },
  ],
});
