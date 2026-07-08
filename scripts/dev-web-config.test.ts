import { describe, expect, test } from "bun:test";
import {
  envFileContent,
  missingRequiredLocalDevSecrets,
  missingRequiredLocalDevSecretsMessage,
  wranglerClerkEnvEntries,
  wranglerDevEnvFileArgs,
  wranglerDevEnvEntries,
  wranglerDevVarArgs,
  wranglerLocalConfigArgs,
} from "./dev-web-config";

describe("dev web config", () => {
  test("passes Clerk secrets through an env file instead of argv vars", () => {
    const entries = wranglerClerkEnvEntries({
      CLERK_AUTHORIZED_PARTIES: "http://localhost:3000",
      CLERK_PUBLISHABLE_KEY: "pk_test_public",
      CLERK_SECRET_KEY: "sk_test_secret",
    });
    const args = wranglerDevEnvFileArgs("/tmp/nudge-worker.env");

    expect(entries).toEqual([["CLERK_SECRET_KEY", "sk_test_secret"]]);
    expect(args).toEqual(["--env-file", "/tmp/nudge-worker.env"]);
    expect(args).not.toContain("--var");
    expect(args.join(" ")).not.toContain("sk_test_secret");
  });

  test("passes Worker runtime secrets through the same env file", () => {
    const entries = wranglerDevEnvEntries({
      CLERK_AUTHORIZED_PARTIES: "http://localhost:3000",
      CLERK_PUBLISHABLE_KEY: "pk_test_public",
      CLERK_SECRET_KEY: "sk_test_secret",
      CONVEX_RUNTIME_SECRET: "convex-runtime-secret",
      CONVEX_URL: "https://convex.example",
    });

    expect(entries).toEqual([
      ["CLERK_SECRET_KEY", "sk_test_secret"],
      ["CONVEX_RUNTIME_SECRET", "convex-runtime-secret"],
    ]);
  });

  test("passes local authorized parties as a non-secret Wrangler var", () => {
    const args = wranglerDevVarArgs([["CLERK_AUTHORIZED_PARTIES", "http://localhost:43300"]]);

    expect(args).toEqual(["--var", "CLERK_AUTHORIZED_PARTIES:http://localhost:43300"]);
  });

  test("reports missing local Worker secrets before starting dev services", () => {
    expect(missingRequiredLocalDevSecrets({})).toEqual([
      "CLERK_SECRET_KEY",
      "CONVEX_RUNTIME_SECRET",
    ]);
    expect(
      missingRequiredLocalDevSecrets({
        CLERK_SECRET_KEY: "sk_test_secret",
        CONVEX_RUNTIME_SECRET: "convex-runtime-secret",
      }),
    ).toEqual([]);
    expect(missingRequiredLocalDevSecretsMessage(["CLERK_SECRET_KEY"])).toContain(
      "Missing required local Worker secrets: CLERK_SECRET_KEY",
    );
    expect(missingRequiredLocalDevSecretsMessage([])).toBeNull();
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
