import { describe, expect, test } from "bun:test";
import {
  braintrustGatewayHeaders,
  braintrustGatewayProvider,
  cloudflareWorkersAiProvider,
  resolveNudgeAiModels,
} from "./index";

describe("@nudge/ai", () => {
  test("resolves Braintrust Gateway models when it is explicitly configured", () => {
    const models = resolveNudgeAiModels({
      braintrustApiKey: "bt-st-test",
      braintrustGatewayUrl: "https://gateway.euw.braintrust.dev",
      braintrustOrgName: "Nudge",
      braintrustProjectId: "project_123",
      extractionModel: "gpt-5-mini",
      provider: braintrustGatewayProvider,
      thinkModel: "claude-sonnet-4-5",
    });

    expect(models.provider).toBe(braintrustGatewayProvider);
    expect(models.extractionModelName).toBe("gpt-5-mini");
    expect(models.extractionModel.supportsStructuredOutputs).toBeTrue();
    expect(models.thinkModelName).toBe("claude-sonnet-4-5");
  });

  test("routes and logs Braintrust Gateway calls to the configured project", () => {
    expect(
      braintrustGatewayHeaders({
        braintrustOrgName: " Teampitch ",
        braintrustProjectId: " 2ce231a6-edbc-4e8d-8bfe-a54e70bdb738 ",
      }),
    ).toEqual({
      "x-bt-org-name": "Teampitch",
      "x-bt-parent": "project_id:2ce231a6-edbc-4e8d-8bfe-a54e70bdb738",
      "x-bt-project-id": "2ce231a6-edbc-4e8d-8bfe-a54e70bdb738",
    });
  });

  test("keeps Workers AI as the default when only tracing has a Braintrust key", () => {
    const workersAi = (() => ({ provider: "test-workers-ai" })) as Ai;

    const models = resolveNudgeAiModels({
      braintrustApiKey: "bt-st-test",
      thinkModel: "@cf/test/model",
      workersAi,
    });

    expect(models.provider).toBe(cloudflareWorkersAiProvider);
  });

  test("falls back to Workers AI when Braintrust Gateway is not configured", () => {
    const workersAi = (() => ({ provider: "test-workers-ai" })) as Ai;

    const models = resolveNudgeAiModels({
      thinkModel: "@cf/test/model",
      workersAi,
    });

    expect(models.provider).toBe(cloudflareWorkersAiProvider);
    expect(models.extractionModelName).toBe("@cf/test/model");
    expect(models.thinkModelName).toBe("@cf/test/model");
  });

  test("fails closed when Braintrust Gateway is explicitly selected without a key", () => {
    expect(() =>
      resolveNudgeAiModels({
        provider: braintrustGatewayProvider,
        thinkModel: "gpt-5-mini",
        workersAi: (() => ({ provider: "test-workers-ai" })) as Ai,
      }),
    ).toThrow("BRAINTRUST_API_KEY is required");
  });
});
