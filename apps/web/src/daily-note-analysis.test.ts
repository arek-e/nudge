import { describe, expect, test } from "bun:test";
import {
  DailyNoteExtractionHttpError,
  dailyNoteExtractionFromObject,
  dailyNoteExtractionObjectSchema,
  dailyNoteAnalysisErrorCode,
  dailyNoteAnalysisExtractionStepConfig,
  emptyDailyNoteExtraction,
} from "./daily-note-analysis";

describe("daily note analysis", () => {
  test("keeps interactive extraction retries short", () => {
    expect(dailyNoteAnalysisExtractionStepConfig).toEqual({
      retries: {
        limit: 1,
        delay: 1_000,
        backoff: "exponential",
      },
      timeout: "45 seconds",
    });
  });

  test("classifies model timeouts for agent run status", () => {
    expect(
      dailyNoteAnalysisErrorCode(
        new DOMException("The operation was aborted due to timeout", "TimeoutError"),
      ),
    ).toBe("AI_EXTRACTION_TIMEOUT");

    expect(
      dailyNoteAnalysisErrorCode(new DailyNoteExtractionHttpError(504, "ai_extraction_timeout")),
    ).toBe("AI_EXTRACTION_TIMEOUT");

    expect(
      dailyNoteAnalysisErrorCode(
        new Error(
          "DailyNoteExtractionHttpError: Daily note extraction failed with 504: ai_extraction_timeout",
        ),
      ),
    ).toBe("AI_EXTRACTION_TIMEOUT");
  });

  test("classifies non-timeout extraction HTTP failures by status", () => {
    expect(dailyNoteAnalysisErrorCode(new DailyNoteExtractionHttpError(502))).toBe(
      "AI_EXTRACTION_HTTP_502",
    );

    expect(
      dailyNoteAnalysisErrorCode(
        new DailyNoteExtractionHttpError(502, "AI_NoObjectGeneratedError"),
      ),
    ).toBe("AI_NO_OBJECT_GENERATED");

    expect(
      dailyNoteAnalysisErrorCode(
        new Error(
          "DailyNoteExtractionHttpError: Daily note extraction failed with 502: ai_extraction_failed",
        ),
      ),
    ).toBe("AI_EXTRACTION_HTTP_502");
  });

  test("builds empty extraction fallback results", () => {
    expect(
      emptyDailyNoteExtraction({
        model: "@cf/test/model",
        provider: "cloudflare-workers-ai",
      }),
    ).toEqual({
      items: [],
      model: "@cf/test/model",
      provider: "cloudflare-workers-ai",
    });
  });

  test("normalizes generated extraction objects with provider metadata", () => {
    const result = dailyNoteExtractionFromObject({
      model: "@cf/test/model",
      object: {
        dailySummary: undefined,
        items: [
          {
            body: "Ask Maya for launch copy.",
            kind: "follow_up",
            title: "Ask Maya for launch copy",
          },
        ],
      },
      provider: "cloudflare-workers-ai",
    });

    expect(result.items).toHaveLength(1);
    expect(result.provider).toBe("cloudflare-workers-ai");
  });

  test("normalizes null optional model fields before persisting extraction output", () => {
    const result = dailyNoteExtractionFromObject({
      model: "glm-5.2",
      object: dailyNoteExtractionObjectSchema.parse({
        dailySummary: null,
        items: [
          {
            body: "Follow up with Maya tomorrow.",
            confidence: null,
            dueAt: "2026-07-06",
            eventEndsAt: null,
            eventStartsAt: null,
            kind: "follow_up",
            remindAt: null,
            title: "Follow up with Maya",
          },
        ],
      }),
      provider: "braintrust-gateway",
    });

    expect(result.dailySummary).toBeUndefined();
    expect(result.items).toEqual([
      {
        body: "Follow up with Maya tomorrow.",
        dueAt: "2026-07-06",
        kind: "follow_up",
        title: "Follow up with Maya",
      },
    ]);
  });
});
