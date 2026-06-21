import { defineConfig, devices } from "@playwright/test";
import { findAvailablePort, preferredDevPort } from "../../scripts/dev-ports";

const shouldStartWebServer = !process.env.PLAYWRIGHT_BASE_URL;
const devPort = shouldStartWebServer
  ? await findAvailablePort({ preferredPort: preferredDevPort() })
  : undefined;
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${devPort}`;

process.env.PLAYWRIGHT_BASE_URL = baseURL;

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.pw.ts",
  webServer: shouldStartWebServer
    ? {
        command: `bun run build && wrangler d1 migrations apply DB --local && wrangler dev --port ${devPort}`,
        reuseExistingServer: false,
        url: baseURL,
      }
    : undefined,
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "mobile-safari",
      use: { ...devices["iPhone 15"] },
    },
  ],
});
