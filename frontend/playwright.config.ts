import { defineConfig, devices } from '@playwright/test'

// Laeuft gegen den gebauten Teststack (e2e/docker-compose.e2e.yml), nicht gegen
// den Vite-Dev-Server: CSP, nginx und Produktions-Build sollen mitgeprueft werden.
export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/global-setup.ts',
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: process.env.WQ_E2E_BASE_URL ?? 'http://localhost:18080',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
