import { defineConfig, devices } from "@playwright/test";
import {
  findAvailablePort,
  preferredDevPort,
  preferredInspectorPort,
  wranglerPersistTo,
} from "../../scripts/dev-ports";

const shouldStartWebServer = !process.env.PLAYWRIGHT_BASE_URL;
const repoRoot = new URL("../..", import.meta.url).pathname;
const devPort = shouldStartWebServer
  ? await findAvailablePort({ preferredPort: preferredDevPort() })
  : undefined;
const inspectorPort =
  devPort === undefined
    ? undefined
    : await findAvailablePort({ preferredPort: preferredInspectorPort(devPort) });
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${devPort}`;
const clerkPublishableKey =
  process.env.CLERK_PUBLISHABLE_KEY ??
  process.env.VITE_CLERK_PUBLISHABLE_KEY ??
  "pk_test_dWx0aW1hdGUta2l3aS05Mi5jbGVyay5hY2NvdW50cy5kZXYk";
const persistTo = wranglerPersistTo(repoRoot);

process.env.PLAYWRIGHT_BASE_URL = baseURL;

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.pw.ts",
  webServer: shouldStartWebServer
    ? {
        command: [
          `VITE_NUDGE_ANONYMOUS_UI=1 CLERK_PUBLISHABLE_KEY=${shellQuote(clerkPublishableKey)} VITE_CLERK_PUBLISHABLE_KEY=${shellQuote(clerkPublishableKey)} bun run build`,
          [
            "wrangler dev",
            "--config wrangler.local.jsonc",
            "--local",
            `--port ${devPort}`,
            `--inspector-port ${inspectorPort}`,
            `--persist-to ${shellQuote(persistTo)}`,
            `--var ${shellQuote(`CLERK_PUBLISHABLE_KEY:${clerkPublishableKey}`)}`,
          ].join(" "),
        ].join(" && "),
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
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});

function shellQuote(value: string) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}
