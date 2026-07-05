import { describe, expect, test } from "bun:test";
import {
  envFileContent,
  wranglerClerkEnvEntries,
  wranglerClerkEnvFileArgs,
  wranglerLocalConfigArgs,
} from "./dev-web-config";

describe("dev web config", () => {
  test("passes Clerk dev values through an env file instead of argv vars", () => {
    const entries = wranglerClerkEnvEntries({
      CLERK_AUTHORIZED_PARTIES: "http://localhost:3000",
      CLERK_PUBLISHABLE_KEY: "pk_test_public",
      CLERK_SECRET_KEY: "sk_test_secret",
    });
    const args = wranglerClerkEnvFileArgs("/tmp/nudge-clerk.env");

    expect(entries).toEqual([
      ["CLERK_AUTHORIZED_PARTIES", "http://localhost:3000"],
      ["CLERK_PUBLISHABLE_KEY", "pk_test_public"],
      ["CLERK_SECRET_KEY", "sk_test_secret"],
    ]);
    expect(args).toEqual(["--env-file", "/tmp/nudge-clerk.env"]);
    expect(args).not.toContain("--var");
    expect(args.join(" ")).not.toContain("sk_test_secret");
  });

  test("quotes generated env file values", () => {
    const content = envFileContent([
      ["CLERK_SECRET_KEY", "sk_test_secret"],
      ["CLERK_AUTHORIZED_PARTIES", 'http://localhost:3000,"quoted"'],
    ]);

    expect(content).toBe(
      'CLERK_SECRET_KEY="sk_test_secret"\n' +
        'CLERK_AUTHORIZED_PARTIES="http://localhost:3000,\\"quoted\\""\n',
    );
  });

  test("keeps the local Wrangler config default unless the caller opts out", () => {
    expect(wranglerLocalConfigArgs([])).toEqual(["--config", "wrangler.local.jsonc"]);
    expect(wranglerLocalConfigArgs(["--remote"])).toEqual([]);
    expect(wranglerLocalConfigArgs(["--config", "wrangler.jsonc"])).toEqual([]);
    expect(wranglerLocalConfigArgs(["-c", "wrangler.jsonc"])).toEqual([]);
    expect(wranglerLocalConfigArgs(["--config=wrangler.jsonc"])).toEqual([]);
  });
});
