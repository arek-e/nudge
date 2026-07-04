import { describe, expect, test } from "bun:test";
import { Db } from "@nudge/db";
import type { Env } from "./env";
import { resolveDbLayerForEnv } from "./db-layer";

const testWorkflow = {
  create: async (input?: { readonly id?: string }) => ({ id: input?.id ?? "test-workflow-id" }),
} as Workflow;

const baseEnv = {
  DAILY_DIGEST_WORKFLOW: testWorkflow,
  USER_AGENT_SESSION: {} as DurableObjectNamespace,
  ENVIRONMENT: "test",
  APP_VERSION: "test-version",
  LOG_HTTP_REQUESTS: "false",
  AI: (() => ({ provider: "test" })) as Ai,
  EXTRACTION_MODEL: "@cf/zai-org/glm-4.7-flash",
  THINK_MODEL: "@cf/moonshotai/kimi-k2.6",
} satisfies Env;

describe("runtime DB layer", () => {
  test("requires Convex runtime configuration outside explicit test overrides", () => {
    expect(() => resolveDbLayerForEnv(baseEnv)).toThrow(
      "Convex runtime store is not configured. Set CONVEX_URL and CONVEX_RUNTIME_SECRET.",
    );
  });

  test("allows tests and local seams to inject an explicit DB layer", () => {
    expect(resolveDbLayerForEnv(baseEnv, Db.layerMemory)).toBe(Db.layerMemory);
  });

  test("requires both Convex URL and runtime secret", () => {
    expect(() =>
      resolveDbLayerForEnv({
        ...baseEnv,
        CONVEX_URL: "https://grandiose-hamster-855.eu-west-1.convex.cloud",
      }),
    ).toThrow("Convex runtime store is not configured");
  });
});
