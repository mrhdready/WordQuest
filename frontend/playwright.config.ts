import { defineConfig, devices } from '@playwright/test'

// Laeuft gegen den gebauten Teststack (e2e/docker-compose.e2e.yml), nicht gegen
// den Vite-Dev-Server: CSP, nginx und Produktions-Build sollen mitgeprueft werden.
// HTTPS wie im Betrieb: global-setup setzt WQ_E2E_SPKI, die Worker vertrauen damit
// genau dem ausgelieferten Zertifikat (vertrauter Pfad mit Service Worker).
// learn.spec ersetzt launchOptions und prueft den Warnpfad ohne Vertrauen.
const spki = process.env.WQ_E2E_SPKI

export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/global-setup.ts',
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: process.env.WQ_E2E_BASE_URL ?? 'https://localhost:18443',
    ...(spki ? { launchOptions: { args: [`--ignore-certificate-errors-spki-list=${spki}`] } } : {}),
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
