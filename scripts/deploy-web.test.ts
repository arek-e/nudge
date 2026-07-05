import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

describe("deploy script", () => {
  test("runs checks before uploading a Worker deploy", async () => {
    const script = await readFile(new URL("./deploy-web.ts", import.meta.url), "utf8");

    const check = script.indexOf('["mise", "exec", "--", "bun", "run", "check"]');
    const deploy = script.indexOf(
      '["mise", "exec", "--", "bunx", "wrangler", "deploy", ...deployArgs]',
    );

    expect(check).toBeGreaterThan(-1);
    expect(deploy).toBeGreaterThan(-1);
    expect(check).toBeLessThan(deploy);
  });
});
