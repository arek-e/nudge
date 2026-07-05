import { Effect } from "effect";
import type { FrameRecord } from "@nudge/db";
import { PrimitiveWorkflows } from "@nudge/effect-services";
import type { ApiContext } from "../context";
import { type ApiAction, recordApiSpan, runWorkflow } from "./effect-helpers";
import { type ToSynthesisResponseResult, toSynthesisResponse } from "./synthesis-response";

export interface CreateSynthesisInput {
  readonly context: ApiContext;
  readonly frameKey?: string;
}

export interface CreateSynthesisResult {
  readonly frame: FrameRecord;
  readonly synthesis: ToSynthesisResponseResult;
}

export function createSynthesis(input: CreateSynthesisInput): ApiAction<CreateSynthesisResult> {
  return recordApiSpan({
    attributes: { "nudge.frame_key": input.frameKey },
    context: input.context,
    name: "syntheses.create",
    effect: runWorkflow({
      workflow: PrimitiveWorkflows.createSynthesis({
        frameKey: input.frameKey ?? "current_state",
        user: input.context.user,
      }),
    }).pipe(
      Effect.map(({ frame, synthesis }) => ({
        frame,
        synthesis: toSynthesisResponse({ synthesis }),
      })),
    ),
  });
}
