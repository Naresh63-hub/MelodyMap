import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  expect: {
    timeout: 15_000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3000",
    channel: process.env.CI ? undefined : "chrome",
    trace: "on-first-retry",
    headless: true,
  },
  webServer: {
    command: "node .output/server/index.mjs",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: false,
    timeout: 15_000,
  },
});
