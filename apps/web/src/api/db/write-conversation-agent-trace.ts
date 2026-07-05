import { Effect } from "effect";
import { persistAgentTraceRun, safeErrorFields } from "@nudge/observability";

export interface WriteConversationAgentTraceInput {
  readonly artifactBucket?: R2Bucket;
  readonly conversationId: string;
  readonly response: {
    readonly draft: unknown | null;
    readonly memoryResults: ReadonlyArray<unknown>;
    readonly usedTools: ReadonlyArray<string>;
  };
  readonly startedAt: string;
  readonly traceDb?: D1Database;
  readonly userId: string;
}

export type WriteConversationAgentTraceResult = void;

export function writeConversationAgentTrace(
  input: WriteConversationAgentTraceInput,
): Effect.Effect<WriteConversationAgentTraceResult, unknown> {
  const traceDb = input.traceDb;
  if (typeof traceDb?.prepare !== "function") return Effect.void;

  return Effect.tryPromise({
    try: () =>
      persistAgentTraceRun(
        {
          artifactPrefix: "agent-runs/conversation",
          db: traceDb,
          ...(input.artifactBucket ? { artifactBucket: input.artifactBucket } : {}),
        },
        {
          agentName: "conversation-agent",
          completedAt: new Date().toISOString(),
          outcomeLabels: [
            "completed",
            `conversation:${input.conversationId}`,
            input.response.draft ? "draft:proposal" : "draft:none",
            `memory:${input.response.memoryResults.length}`,
          ],
          startedAt: input.startedAt,
          status: "completed",
          toolCalls: input.response.usedTools.map((tool) => ({ status: "completed", tool })),
          userId: input.userId,
        },
      ),
    catch: (error) => error,
  }).pipe(
    Effect.catch((error) =>
      Effect.sync(() => {
        console.warn(
          JSON.stringify({
            agentName: "conversation-agent",
            event: "agent_trace_persist_failed",
            logKind: "wide_event",
            ...safeErrorFields(error),
          }),
        );
      }),
    ),
    Effect.asVoid,
  );
}
