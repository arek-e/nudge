import { z } from "zod";
import type { DurableWorkflowStepConfig } from "@nudge/effect-services";

const nullAsUndefined = (value: unknown) => (value === null ? undefined : value);
const optionalString = (schema: z.ZodString) => z.preprocess(nullAsUndefined, schema.optional());
const optionalNumber = (schema: z.ZodNumber) => z.preprocess(nullAsUndefined, schema.optional());

export const dailyNoteExtractedItemSchema = z.object({
  body: z.string().min(1).max(2_000),
  confidence: optionalNumber(z.number().min(0).max(1)),
  dueAt: optionalString(z.string()),
  eventEndsAt: optionalString(z.string()),
  eventStartsAt: optionalString(z.string()),
  kind: z.enum(["task", "reminder", "follow_up", "event", "memory", "question", "idea"]),
  remindAt: optionalString(z.string()),
  title: z.string().min(1).max(200),
});

export const dailyNoteExtractionObjectSchema = z.object({
  dailySummary: optionalString(z.string().max(2_000)),
  items: z.array(dailyNoteExtractedItemSchema).default([]),
});

export const dailyNoteExtractionSchema = dailyNoteExtractionObjectSchema.extend({
  model: z.string().min(1),
  provider: z.string().min(1),
});

export type DailyNoteExtractedItem = z.infer<typeof dailyNoteExtractedItemSchema>;
export type DailyNoteExtractionObject = z.infer<typeof dailyNoteExtractionObjectSchema>;
export type DailyNoteExtraction = z.infer<typeof dailyNoteExtractionSchema>;

export const dailyNoteAnalysisExtractionStepConfig = {
  retries: {
    limit: 1,
    delay: 1_000,
    backoff: "exponential",
  },
  timeout: "45 seconds",
} satisfies DurableWorkflowStepConfig<"45 seconds">;

export class DailyNoteExtractionHttpError extends Error {
  readonly responseError: string | null;
  readonly status: number;

  constructor(status: number, responseError: string | null = null) {
    super(
      responseError
        ? `Daily note extraction failed with ${status}: ${responseError}`
        : `Daily note extraction failed with ${status}`,
    );
    this.name = "DailyNoteExtractionHttpError";
    this.responseError = responseError;
    this.status = status;
  }
}

export const dailyNoteAnalysisErrorCode = (error: unknown) => {
  if (isTimeoutError(error)) return "AI_EXTRACTION_TIMEOUT";
  if (error instanceof DailyNoteExtractionHttpError) {
    if (error.status === 504 || error.responseError === "ai_extraction_timeout") {
      return "AI_EXTRACTION_TIMEOUT";
    }
    const providerErrorCode = dailyNoteAnalysisProviderErrorCode(error.responseError);
    if (providerErrorCode) return providerErrorCode;
    return `AI_EXTRACTION_HTTP_${error.status}`;
  }
  if (error instanceof Error) {
    const providerErrorCode = dailyNoteAnalysisProviderErrorCode(error.message);
    if (providerErrorCode) return providerErrorCode;
    const extractionStatus = error.message.match(/Daily note extraction failed with (\d{3})/);
    if (extractionStatus?.[1]) return `AI_EXTRACTION_HTTP_${extractionStatus[1]}`;
    if (error.name) return error.name;
  }
  return "Error";
};

export const dailyNoteAnalysisHttpStatus = (errorCode: string) =>
  errorCode === "AI_EXTRACTION_TIMEOUT" ? 504 : 502;

export const dailyNoteAnalysisResponseError = (errorCode: string) =>
  errorCode === "AI_EXTRACTION_TIMEOUT" ? "ai_extraction_timeout" : "ai_extraction_failed";

export function emptyDailyNoteExtraction(
  modelRef: Pick<DailyNoteExtraction, "model" | "provider">,
): DailyNoteExtraction {
  return {
    items: [],
    model: modelRef.model,
    provider: modelRef.provider,
  };
}

export function dailyNoteExtractionFromObject(input: {
  readonly model: string;
  readonly object: DailyNoteExtractionObject;
  readonly provider: string;
}): DailyNoteExtraction {
  return dailyNoteExtractionSchema.parse({
    ...input.object,
    model: input.model,
    provider: input.provider,
  });
}

const isTimeoutError = (error: unknown) => {
  if (error instanceof DOMException && error.name === "TimeoutError") return true;
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    error.name === "TimeoutError" ||
    message.includes("aborted due to timeout") ||
    message.includes("ai_extraction_timeout") ||
    message.includes("daily note extraction failed with 504")
  );
};

const dailyNoteAnalysisProviderErrorCode = (value: string | null) => {
  if (!value) return null;
  if (value.includes("AI_NoObjectGeneratedError")) return "AI_NO_OBJECT_GENERATED";
  return null;
};
