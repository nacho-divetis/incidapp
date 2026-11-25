import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 3100);
const isCi = Boolean(process.env.CI);

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  // Una sola base compartida: los tests crean sus propios datos y se ejecutan en serie.
  workers: 1,
  fullyParallel: false,
  retries: isCi ? 1 : 0,
  forbidOnly: isCi,
  outputDir: '../test-results',
  reporter: isCi
    ? [['github'], ['html', { open: 'never', outputFolder: '../playwright-report' }]]
    : [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    locale: 'es-ES',
    timezoneId: 'Europe/Madrid',
    trace: isCi ? 'on-first-retry' : 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node e2e/start-server.mjs',
    url: `http://127.0.0.1:${PORT}/api/health`,
    cwd: '..',
    timeout: 120_000,
    // Siempre una base nueva: nunca se reutiliza un servidor ya arrancado.
    reuseExistingServer: false,
    env: { E2E_PORT: String(PORT) },
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
