import { Effect } from "effect";
import type { EventRecord } from "@nudge/db";
import { PrimitiveWorkflows } from "@nudge/effect-services";
import type { ApiContext } from "../context";
import { type ApiAction, runWorkflow } from "./effect-helpers";

export interface LogVoiceInput {
  readonly context: ApiContext;
  readonly idempotencyKey?: string;
  readonly occurredAt?: string;
  readonly spokenText: string;
}

type VoiceLogRoute = "reasoning_candidate" | "capture_only";

const reasoningVoiceLogPrefixes = [
  "what ",
  "why ",
  "how ",
  "should ",
  "can ",
  "could ",
  "help ",
  "follow up",
  "remind ",
];

function classifyVoiceLogRoute(spokenText: string): VoiceLogRoute {
  const text = spokenText.trim().toLowerCase();
  return text.includes("?") || reasoningVoiceLogPrefixes.some((prefix) => text.startsWith(prefix))
    ? "reasoning_candidate"
    : "capture_only";
}

export interface LogVoiceResult {
  readonly capture: EventRecord;
  readonly route: VoiceLogRoute;
  readonly spokenResponse: string;
}

export function logVoice(input: LogVoiceInput): ApiAction<LogVoiceResult> {
  const route = classifyVoiceLogRoute(input.spokenText);
  const spokenResponse =
    route === "reasoning_candidate"
      ? "Understood. I'm processing it in Nudge."
      : "Understood. I logged it to Nudge.";
  return runWorkflow({
    workflow: PrimitiveWorkflows.appendSignal({
      occurredAt: input.occurredAt ?? new Date().toISOString(),
      payload: { route, text: input.spokenText },
      schemaVersion: 1,
      source: "ios_siri",
      type: "capture.voice_log",
      user: input.context.user,
      ...(input.idempotencyKey !== undefined ? { idempotencyKey: input.idempotencyKey } : {}),
    }),
  }).pipe(Effect.map((capture) => ({ capture, route, spokenResponse })));
}
