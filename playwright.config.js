import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 90000,
  use: {
    viewport: { width: 1920, height: 1080 },
    locale: 'pt-BR',
    colorScheme: 'dark',
    timezoneId: 'America/Sao_Paulo',
    actionTimeout: 10000,
    navigationTimeout: 45000,
  },
  snapshotDir: './reference',
  snapshotPathTemplate: '{snapshotDir}/{arg}.png',
});
