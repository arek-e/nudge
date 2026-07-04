import { describe, expect, test } from "bun:test";
import { braintrustRawAiTelemetryEnabled } from "./braintrust-tracing";

describe("braintrust tracing controls", () => {
  test("requires an API key and explicit raw telemetry opt-in", () => {
    expect(
      braintrustRawAiTelemetryEnabled({
        BRAINTRUST_API_KEY: "test-key",
        BRAINTRUST_RAW_AI_TELEMETRY: "true",
      }),
    ).toBe(true);
    expect(
      braintrustRawAiTelemetryEnabled({
        BRAINTRUST_API_KEY: "test-key",
        BRAINTRUST_RAW_AI_TELEMETRY: "false",
      }),
    ).toBe(false);
    expect(
      braintrustRawAiTelemetryEnabled({
        BRAINTRUST_RAW_AI_TELEMETRY: "true",
      }),
    ).toBe(false);
  });
});
