import { describe, expect, test } from "bun:test";
import {
  DailyNoteExtractionHttpError,
  dailyNoteAnalysisErrorCode,
  dailyNoteAnalysisExtractionStepConfig,
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
});
