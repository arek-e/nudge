import { defineConfig, devices } from "@playwright/test";
import {
  findAvailablePort,
  localDevUrl,
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
const authUrl =
  devPort === undefined ? undefined : (process.env.BETTER_AUTH_URL ?? localDevUrl(devPort));
const persistTo = wranglerPersistTo(repoRoot);

process.env.PLAYWRIGHT_BASE_URL = baseURL;

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.pw.ts",
  webServer: shouldStartWebServer
    ? {
        command: [
          "bun run build",
          `wrangler d1 migrations apply DB --local --cwd ../engine --persist-to ${shellQuote(persistTo)}`,
          [
            "wrangler dev",
            "--cwd ../engine",
            `--port ${devPort}`,
            `--inspector-port ${inspectorPort}`,
            `--persist-to ${shellQuote(persistTo)}`,
            `--var ${shellQuote(`BETTER_AUTH_URL:${authUrl}`)}`,
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
      name: "mobile-safari",
      use: { ...devices["iPhone 15"] },
    },
  ],
});

function shellQuote(value: string) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}
