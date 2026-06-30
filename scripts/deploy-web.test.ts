import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

describe("deploy script", () => {
  test("runs checks before uploading a Worker deploy", async () => {
    const script = await readFile(new URL("./deploy-web.ts", import.meta.url), "utf8");

    const check = script.indexOf("bun run check");
    const deploy = script.indexOf("wrangler deploy");

    expect(check).toBeGreaterThan(-1);
    expect(check).toBeLessThan(deploy);
  });
});
