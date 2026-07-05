import { Effect } from "effect";
import type { EventRecord, ProposalRecord } from "@nudge/db";
import { PrimitiveWorkflows } from "@nudge/effect-services";
import type { ApiContext } from "../context";
import { type ApiAction, runWorkflow } from "./effect-helpers";

export interface SubmitQuickCaptureInput {
  readonly context: ApiContext;
  readonly idempotencyKey?: string;
  readonly note: string;
  readonly occurredAt?: string;
}

interface QuickCaptureDraftResponse {
  readonly confidence: number;
  readonly proposal: ProposalRecord;
  readonly requiresReview: true;
}

export interface SubmitQuickCaptureResult {
  readonly capture: EventRecord;
  readonly draft: QuickCaptureDraftResponse | null;
  readonly processingStatus: "drafted" | "captured";
}

function quickCaptureSourceFromClient(value: string | undefined) {
  switch (value) {
    case "desktop":
      return "desktop_app";
    case "ios":
      return "ios_app";
    case "raycast":
      return "raycast_extension";
    case "web":
    default:
      return "web_app";
  }
}

export function submitQuickCapture(
  input: SubmitQuickCaptureInput,
): ApiAction<SubmitQuickCaptureResult> {
  return runWorkflow({
    workflow: PrimitiveWorkflows.draftLoopIntake({
      conversationId: "quick-capture",
      ...(input.idempotencyKey !== undefined ? { idempotencyKey: input.idempotencyKey } : {}),
      message: input.note,
      ...(input.occurredAt !== undefined ? { occurredAt: input.occurredAt } : {}),
      source: quickCaptureSourceFromClient(input.context.clientSurface),
      user: input.context.user,
    }),
  }).pipe(
    Effect.map((result) => ({
      capture: result.signal,
      draft: result.draft
        ? {
            confidence: result.draft.confidence,
            proposal: result.draft.proposal,
            requiresReview: true,
          }
        : null,
      processingStatus: result.draft ? "drafted" : "captured",
    })),
  );
}
