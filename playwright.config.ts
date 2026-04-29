/**
 * Playwright Configuration
 *
 * Docs: https://playwright.dev/docs/test-configuration
 *
 * Usage:
 *   npx playwright test              # Run all tests
 *   npx playwright test --debug      # Debug mode
 *   npx playwright test --ui         # Interactive UI
 *   npx playwright test --project=chromium  # Single browser
 */

import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  // Look for test files in the tests/e2e directory
  testDir: "./tests/e2e",

  // Maximum time a test can run
  timeout: 30_000,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Reporter
  reporter: process.env.CI ? "github" : "html",

  // Shared settings for all projects
  use: {
    // Base URL for page.goto() — update to match your dev server
    baseURL: "http://localhost:3000",

    // Collect trace on first retry
    trace: "on-first-retry",

    // Screenshot on failure
    screenshot: "only-on-failure",
  },

  // Browser projects
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    // Uncomment to test additional browsers:
    // {
    //   name: "firefox",
    //   use: { ...devices["Desktop Firefox"] },
    // },
    // {
    //   name: "mobile",
    //   use: { ...devices["iPhone 14"] },
    // },
  ],

  // Auto-start dev server before tests
  // Uncomment and update for your project:
  // webServer: {
  //   command: "npm run dev",
  //   port: 3000,
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 120_000,
  // },
});
