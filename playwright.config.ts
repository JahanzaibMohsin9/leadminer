import { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  testDir: './tests',
  testMatch: /.*\.spec\.ts/,
  timeout: 60000,
  retries: 0,
  outputDir: 'test-results/',
  use: {
    trace: 'on-first-retry',
  },
};

export default config;
