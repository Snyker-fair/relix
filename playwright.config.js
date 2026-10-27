// The interface's smoke tests (tests/e2e): the demo in a real browser, at the
// TV's size, driven with the keyboard like a controller. `npm run e2e`
// builds it and serves it by itself. The first time, on the PC:
// `npx playwright install chromium`.
import { defineConfig } from '@playwright/test'

const PORT = 5273
const CI = Boolean(process.env.CI)

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  reporter: CI ? [['github'], ['list']] : 'list',
  use: {
    browserName: 'chromium',
    baseURL: `http://localhost:${PORT}/`,
    // Relix is drawn for 1920 × 1080 (the Xbox's TV)
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    locale: 'es-CL',
    timezoneId: 'America/Santiago',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !CI,
    timeout: 120_000,
  },
})
