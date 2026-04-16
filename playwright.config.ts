import { defineConfig } from '@playwright/test';

export default defineConfig({
  retries: 0,
  testDir: './tests',
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['junit', { outputFile: 'test-results/junit.xml' }]
  ]
});

