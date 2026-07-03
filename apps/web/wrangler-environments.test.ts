import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

const webRoot = new URL(".", import.meta.url);
const repoRoot = new URL("../..", import.meta.url);

describe("Nudge Worker environments", () => {
  test("wrangler config defines explicit staging and production deploy environments", async () => {
    const wrangler = await readFile(new URL("wrangler.jsonc", webRoot), "utf8");

    expect(wrangler).toContain('"env"');
    expect(wrangler).toContain('"staging"');
    expect(wrangler).toContain('"production"');
    expect(wrangler).toContain('"name": "nudge-web-staging"');
    expect(wrangler).toContain('"name": "nudge-web"');
    expect(wrangler).toContain('"pattern": "app.staging.explorenudge.com"');
    expect(wrangler).toContain('"custom_domain": true');
    expect(wrangler).toContain('"/__clerk/*"');
    expect(wrangler).toContain('"ENVIRONMENT": "staging"');
    expect(wrangler).toContain('"ENVIRONMENT": "production"');
    expect(wrangler).toContain(
      '"CLERK_AUTHORIZED_PARTIES": "https://app.staging.explorenudge.com,https://nudge-web-staging.teampitch.workers.dev"',
    );
    expect(wrangler).toContain(
      '"CLERK_AUTHORIZED_PARTIES": "https://app.explorenudge.com,https://nudge-web.teampitch.workers.dev"',
    );
    expect(wrangler).toContain(
      '"CLERK_PUBLISHABLE_KEY": "pk_live_Y2xlcmsuYXBwLmV4cGxvcmVudWRnZS5jb20k"',
    );
    expect(wrangler).toContain('"CLERK_PROXY_URL": "https://app.explorenudge.com/__clerk"');
    expect(wrangler).not.toContain('"d1_databases"');
    expect(wrangler).not.toContain('"binding": "DB"');
    expect(wrangler).not.toContain('"TRACE_ARTIFACTS"');
    expect(wrangler).toContain('"bucket_name": "nudge-staging-media"');
    expect(wrangler).toContain('"bucket_name": "nudge-media"');
  });

  test("default deploy targets the production Worker environment", async () => {
    const deployWorkflow = await readFile(
      new URL(".github/workflows/deploy-production.yml", repoRoot),
      "utf8",
    );
    const deployScript = await readFile(new URL("scripts/deploy-web.ts", repoRoot), "utf8");
    const clientEntry = await readFile(new URL("src/client/main.tsx", webRoot), "utf8");

    expect(deployWorkflow).toContain("workflow_dispatch:");
    expect(deployWorkflow).not.toContain("workflow_run:");
    expect(deployWorkflow).toContain("environment: production");
    expect(deployScript).toContain('const deployEnvironment = env ?? "production";');
    expect(deployScript).toContain("const deployTargetArgs = [`--env ${deployEnvironment}`");
    expect(deployScript).toContain('deployEnvironment === "production"');
    expect(deployScript).toContain('"--containers-rollout=none"');
    expect(deployScript).toContain(
      'VITE_CLERK_PUBLISHABLE_KEY: "pk_live_Y2xlcmsuYXBwLmV4cGxvcmVudWRnZS5jb20k"',
    );
    expect(deployScript).toContain('VITE_CLERK_PROXY_URL: "/__clerk"');
    expect(deployScript).toContain(
      'VITE_CONVEX_URL: "https://friendly-lion-904.eu-west-1.convex.cloud"',
    );
    expect(deployScript).toContain(
      'VITE_CONVEX_URL: "https://abundant-retriever-130.eu-west-1.convex.cloud"',
    );
    expect(deployScript).toContain(
      'VITE_NUDGE_LOGO_LONG_SRC: "/icons/nudge-logo-lockup-blobby-n-transparent.svg"',
    );
    expect(clientEntry).toContain(
      'import.meta.env.VITE_CONVEX_URL ?? "https://grandiose-hamster-855.eu-west-1.convex.cloud"',
    );
    expect(clientEntry).toContain("import.meta.env.VITE_CLERK_PROXY_URL");
    expect(clientEntry).toContain("proxyUrl: clerkProxyUrl");
    expect(clientEntry).toContain("import.meta.env.VITE_NUDGE_LOGO_LONG_SRC");
    expect(deployScript).toContain("VITE_CLERK_PUBLISHABLE_KEY");
  });

  test("local dev uses a config that skips the optional sandbox container", async () => {
    const ciWorkflow = await readFile(new URL(".github/workflows/ci.yml", repoRoot), "utf8");
    const devScript = await readFile(new URL("scripts/dev-web.ts", repoRoot), "utf8");
    const localWrangler = await readFile(new URL("wrangler.local.jsonc", webRoot), "utf8");
    const playwrightConfig = await readFile(new URL("playwright.config.ts", webRoot), "utf8");

    expect(ciWorkflow).not.toContain("environment: production");
    expect(ciWorkflow).not.toContain("CLOUDFLARE_API_TOKEN");
    expect(devScript).toContain('["--config", "wrangler.local.jsonc"]');
    expect(playwrightConfig).toContain("--config wrangler.local.jsonc");
    expect(devScript).toContain('args.includes("--remote")');
    expect(localWrangler).not.toContain('"containers"');
    expect(localWrangler).not.toContain('"OKF_SANDBOX"');
    expect(localWrangler).toContain('"/__clerk/*"');
    expect(localWrangler).toContain('"USER_AGENT_SESSION"');
    expect(localWrangler).toContain('"DAILY_DIGEST_WORKFLOW"');
  });
});
