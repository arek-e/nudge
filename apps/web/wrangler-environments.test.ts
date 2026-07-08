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
    expect(wrangler).toContain('"secrets"');
    expect(wrangler).toContain('"required": ["CLERK_SECRET_KEY", "CONVEX_RUNTIME_SECRET"]');
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
    const deployConfig = await readFile(new URL("scripts/deploy-web-config.ts", repoRoot), "utf8");
    const clientEntry = await readFile(new URL("src/client/main.tsx", webRoot), "utf8");

    expect(deployWorkflow).toContain("workflow_dispatch: {}");
    expect(deployWorkflow).toContain("workflow_run:");
    expect(deployWorkflow).toContain("environment: production");
    expect(deployWorkflow).not.toContain("D1 migrations");
    expect(deployScript).toContain('const deployEnvironment = env ?? "production";');
    expect(deployScript).toContain("wranglerDeployArgs");
    expect(deployScript).toContain(
      '["mise", "exec", "--", "bunx", "wrangler", "deploy", ...deployArgs]',
    );
    expect(deployScript).not.toContain('["bash", "-lc"');
    expect(deployConfig).toContain('"--env"');
    expect(deployConfig).toContain('"--var"');
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
    expect(clientEntry).toContain("new ConvexReactClient(requiredConvexUrl())");
    expect(clientEntry).toContain("VITE_CONVEX_URL is required to run Nudge");
    expect(clientEntry).not.toContain(
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
    const devConfig = await readFile(new URL("scripts/dev-web-config.ts", repoRoot), "utf8");
    const worktreeEnv = await readFile(new URL("scripts/worktree-env.sh", repoRoot), "utf8");
    const localWrangler = await readFile(new URL("wrangler.local.jsonc", webRoot), "utf8");
    const playwrightConfig = await readFile(new URL("playwright.config.ts", webRoot), "utf8");

    expect(ciWorkflow).not.toContain("environment: production");
    expect(ciWorkflow).not.toContain("CLOUDFLARE_API_TOKEN");
    expect(ciWorkflow).not.toContain(
      "github.event_name == 'push' && github.ref == 'refs/heads/main'",
    );
    expect(ciWorkflow).toContain("Install Playwright Chromium");
    expect(ciWorkflow).toContain("playwright install --with-deps chromium");
    expect(ciWorkflow).not.toContain("playwright install --with-deps webkit");
    expect(ciWorkflow).toContain("run: bun run test:e2e");
    expect(devConfig).toContain('["--config", "wrangler.local.jsonc"]');
    expect(devConfig).toContain('args.includes("--remote")');
    expect(playwrightConfig).toContain("--config wrangler.local.jsonc");
    expect(playwrightConfig).toContain("VITE_NUDGE_ANONYMOUS_UI=1");
    expect(devConfig).toContain("missingRequiredLocalDevSecrets");
    expect(devScript).toContain("wranglerDevEnvFileArgs");
    expect(devScript).toContain("wranglerDevVarArgs");
    expect(devScript).toContain("writeFile(wranglerEnvFile");
    expect(devScript).toContain("localWorkerEnvSource");
    expect(devScript).toContain("localAuthorizedParties");
    expect(devScript).toContain("NUDGE_VITE_PROXY_TARGET");
    expect(devScript).toContain('"vite"');
    expect(devScript).not.toContain("d1");
    expect(devScript).not.toContain("CLERK_SECRET_KEY:");
    expect(devScript).not.toContain("CONVEX_RUNTIME_SECRET:");
    expect(worktreeEnv).toContain('CONVEX_DEPLOYMENT "dev:grandiose-hamster-855"');
    expect(worktreeEnv).toContain('"https://grandiose-hamster-855.eu-west-1.convex.cloud"');
    expect(localWrangler).not.toContain('"containers"');
    expect(localWrangler).not.toContain('"OKF_SANDBOX"');
    expect(localWrangler).not.toContain('"CLERK_AUTHORIZED_PARTIES"');
    expect(localWrangler).toContain('"/__clerk/*"');
    expect(localWrangler).toContain('"required": ["CLERK_SECRET_KEY", "CONVEX_RUNTIME_SECRET"]');
    expect(localWrangler).toContain('"binding": "AI"');
    expect(localWrangler).toContain('"remote": true');
    expect(localWrangler).toContain('"USER_AGENT_SESSION"');
    expect(localWrangler).toContain('"DAILY_DIGEST_WORKFLOW"');
  });
});
