import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

const webRoot = new URL(".", import.meta.url);
const repoRoot = new URL("../..", import.meta.url);

describe("Vesta Worker environments", () => {
  test("wrangler config defines explicit staging and production deploy environments", async () => {
    const wrangler = await readFile(new URL("wrangler.jsonc", webRoot), "utf8");

    expect(wrangler).toContain('"env"');
    expect(wrangler).toContain('"staging"');
    expect(wrangler).toContain('"production"');
    expect(wrangler).toContain('"name": "vesta-web-staging"');
    expect(wrangler).toContain('"name": "vesta-web"');
    expect(wrangler).toContain('"ENVIRONMENT": "staging"');
    expect(wrangler).toContain('"ENVIRONMENT": "production"');
    expect(wrangler).toContain('"database_name": "vesta-staging"');
    expect(wrangler).toContain('"database_name": "vesta-production"');
    expect(wrangler).toContain('"bucket_name": "vesta-staging-media"');
    expect(wrangler).toContain('"bucket_name": "vesta-media"');
  });

  test("default deploy targets the production Worker environment", async () => {
    const deployScript = await readFile(new URL("scripts/deploy-web.ts", repoRoot), "utf8");
    const clientEntry = await readFile(new URL("src/client/main.tsx", webRoot), "utf8");

    expect(deployScript).toContain('const deployEnvironment = env ?? "production";');
    expect(deployScript).toContain("const deployTargetArgs = [`--env ${deployEnvironment}`");
    expect(deployScript).toContain(
      'VITE_CONVEX_URL: "https://friendly-lion-904.eu-west-1.convex.cloud"',
    );
    expect(deployScript).toContain(
      'VITE_CONVEX_URL: "https://abundant-retriever-130.eu-west-1.convex.cloud"',
    );
    expect(deployScript).toContain('VITE_VESTA_LOGO_LONG_SRC: "/icons/vesta-logo-long-beta.svg"');
    expect(clientEntry).toContain(
      'import.meta.env.VITE_CONVEX_URL ?? "https://grandiose-hamster-855.eu-west-1.convex.cloud"',
    );
    expect(clientEntry).toContain("import.meta.env.VITE_VESTA_LOGO_LONG_SRC");
    expect(deployScript).toContain("VITE_CLERK_PUBLISHABLE_KEY");
  });
});
