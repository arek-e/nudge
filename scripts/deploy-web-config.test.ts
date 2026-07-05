import { describe, expect, test } from "bun:test";
import {
  braintrustGatewaySecretName,
  parseWranglerSecretNames,
  requiredDeploySecretNames,
  validateDeployVersion,
  wranglerDeployArgs,
} from "./deploy-web-config";

describe("deploy web config", () => {
  test("rejects deploy versions with shell metacharacters", () => {
    expect(validateDeployVersion("2026.07.03-abc123")).toBe("2026.07.03-abc123");
    expect(() => validateDeployVersion("abc123;echo pwned")).toThrow("Deploy version");
    expect(() => validateDeployVersion("$(whoami)")).toThrow("Deploy version");
    expect(() => validateDeployVersion("release candidate")).toThrow("Deploy version");
  });

  test("builds Wrangler deploy flags as argv elements", () => {
    const args = wranglerDeployArgs({
      deployEnvironment: "production",
      dryRun: true,
      serverConvexUrl: "https://convex.example",
      version: "abc123-dirty",
    });

    expect(args).toEqual([
      "--env",
      "production",
      "--dry-run",
      "--var",
      "ENVIRONMENT:production",
      "--var",
      "APP_VERSION:abc123-dirty",
      "--var",
      "CONVEX_URL:https://convex.example",
      "--containers-rollout",
      "none",
      "--tag",
      "abc123-dirty",
      "--message",
      "Deploy abc123-dirty",
    ]);
    expect(args.join(" ")).not.toContain(";");
  });

  test("requires the Braintrust secret when Braintrust Gateway is configured", () => {
    expect(
      requiredDeploySecretNames({
        aiProvider: "braintrust-gateway",
        secretNames: parseWranglerSecretNames(
          JSON.stringify([{ name: "CLERK_SECRET_KEY", type: "secret_text" }]),
        ),
      }),
    ).toEqual([braintrustGatewaySecretName]);

    expect(
      requiredDeploySecretNames({
        aiProvider: "braintrust-gateway",
        secretNames: parseWranglerSecretNames(
          JSON.stringify([{ name: braintrustGatewaySecretName, type: "secret_text" }]),
        ),
      }),
    ).toEqual([]);

    expect(
      requiredDeploySecretNames({
        aiProvider: "cloudflare-workers-ai",
        secretNames: new Set(),
      }),
    ).toEqual([]);
  });
});
