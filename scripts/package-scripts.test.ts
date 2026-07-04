import { describe, expect, test } from "bun:test";
import packageJson from "../package.json";

describe("package scripts", () => {
  test("check gates agent workflow changes with evals", () => {
    expect(packageJson.scripts.check).toContain("bun run eval:agent");
  });
});
