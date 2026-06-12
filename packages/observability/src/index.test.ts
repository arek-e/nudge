import { describe, expect, test } from "bun:test";
import { safeErrorFields, shouldSampleWideEvent, statusGroup } from "./index";

describe("observability", () => {
  test("groups HTTP statuses by family", () => {
    expect(statusGroup(200)).toBe("2xx");
    expect(statusGroup(404)).toBe("4xx");
    expect(statusGroup(503)).toBe("5xx");
  });

  test("keeps errors and slow requests during sampling", () => {
    expect(shouldSampleWideEvent({ status: 500 })).toEqual({
      sampled: true,
      sampleReason: "error",
    });
    expect(shouldSampleWideEvent({ durationMs: 2_500 })).toEqual({
      sampled: true,
      sampleReason: "slow",
    });
    expect(shouldSampleWideEvent({ status: 200, durationMs: 20 })).toEqual({
      sampled: true,
      sampleReason: "default",
    });
  });

  test("converts unknown errors into safe fields", () => {
    expect(safeErrorFields(new Error("boom"))).toEqual({
      errorType: "Error",
      errorMessage: "boom",
    });
    expect(safeErrorFields("boom")).toEqual({
      errorType: "string",
      errorMessage: "boom",
    });
  });
});
