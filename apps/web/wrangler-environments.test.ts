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
    expect(wrangler).toContain('"ENVIRONMENT": "staging"');
    expect(wrangler).toContain('"ENVIRONMENT": "production"');
    expect(wrangler).toContain(
      '"CONVEX_URL": "https://abundant-retriever-130.eu-west-1.convex.cloud"',
    );
    expect(wrangler).toContain('"CONVEX_URL": "https://friendly-lion-904.eu-west-1.convex.cloud"');
    expect(wrangler).not.toContain('"d1_databases"');
    expect(wrangler).not.toContain('"binding": "DB"');
    expect(wrangler).not.toContain("trace-artifacts");
    expect(wrangler).toContain('"bucket_name": "nudge-staging-media"');
    expect(wrangler).toContain('"bucket_name": "nudge-media"');
  });

  test("default deploy targets the production Worker environment", async () => {
    const deployScript = await readFile(new URL("scripts/deploy-web.ts", repoRoot), "utf8");
    const clientEntry = await readFile(new URL("src/client/main.tsx", webRoot), "utf8");

    expect(deployScript).toContain('const deployEnvironment = env ?? "production";');
    expect(deployScript).toContain("const deployTargetArgs = [`--env ${deployEnvironment}`");
    expect(deployScript).toContain('deployEnvironment === "production"');
    expect(deployScript).toContain('"--containers-rollout=none"');
    expect(deployScript).toContain(
      'VITE_CONVEX_URL: "https://friendly-lion-904.eu-west-1.convex.cloud"',
    );
    expect(deployScript).toContain(
      'VITE_CONVEX_URL: "https://abundant-retriever-130.eu-west-1.convex.cloud"',
    );
    expect(deployScript).toContain("const serverConvexUrl = clientEnvironment.VITE_CONVEX_URL;");
    expect(deployScript).toContain("`--var CONVEX_URL:${serverConvexUrl}`");
    expect(deployScript).toContain(
      'VITE_NUDGE_LOGO_LONG_SRC: "/icons/nudge-logo-lockup-blobby-n-transparent.svg"',
    );
    expect(clientEntry).toContain(
      'import.meta.env.VITE_CONVEX_URL ?? "https://grandiose-hamster-855.eu-west-1.convex.cloud"',
    );
    expect(clientEntry).toContain("import.meta.env.VITE_NUDGE_LOGO_LONG_SRC");
    expect(deployScript).toContain("VITE_CLERK_PUBLISHABLE_KEY");
  });
});
