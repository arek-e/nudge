import { Effect } from "effect";
import type { FrameRecord } from "@nudge/db";
import { PrimitiveWorkflows } from "@nudge/effect-services";
import type { ApiContext } from "../context";
import { type ApiAction, recordApiSpan, runWorkflow } from "./effect-helpers";
import { type ToSynthesisResponseResult, toSynthesisResponse } from "./synthesis-response";

export interface GetLatestSynthesisInput {
  readonly context: ApiContext;
  readonly frameKey?: string;
}

export interface GetLatestSynthesisResult {
  readonly frame: FrameRecord;
  readonly synthesis: ToSynthesisResponseResult;
}

export function getLatestSynthesis(
  input: GetLatestSynthesisInput,
): ApiAction<GetLatestSynthesisResult> {
  return recordApiSpan({
    attributes: { "nudge.frame_key": input.frameKey },
    context: input.context,
    name: "syntheses.latest",
    effect: runWorkflow({
      workflow: PrimitiveWorkflows.latestSynthesis({
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
