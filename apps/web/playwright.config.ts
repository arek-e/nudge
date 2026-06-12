import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.pw.ts",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "https://lares-web.teampitch.workers.dev",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "mobile-safari",
      use: { ...devices["iPhone 15"] },
    },
  ],
});
