import type { z } from "zod";
import { Effect } from "effect";
import type { ApiContext } from "../context";
import type { ApiAction } from "./effect-helpers";
import { conversationMessageResponseSchema } from "../../api-contract";
import { proxyConversationRequest } from "../../conversation-proxy";
import { writeConversationAgentTrace } from "../db/write-conversation-agent-trace";

export interface SendConversationMessageInput {
  readonly context: ApiContext;
  readonly conversationId: string;
  readonly message: string;
}

export type SendConversationMessageResult = z.infer<typeof conversationMessageResponseSchema>;

export function sendConversationMessage(
  input: SendConversationMessageInput,
): ApiAction<SendConversationMessageResult> {
  return Effect.gen(function* () {
    const startedAt = new Date().toISOString();
    const response = yield* Effect.tryPromise({
      try: () =>
        proxyConversationRequest(
          input.context.agentSessions,
          input.context.agentInternalSecret,
          input.context.user,
          input.conversationId,
          "/messages",
          conversationMessageResponseSchema,
          {
            body: JSON.stringify({ message: input.message }),
            method: "POST",
          },
          input.context.traceHeaders,
        ),
      catch: (cause) => cause,
    });
    yield* writeConversationAgentTrace({
      ...(input.context.traceArtifacts ? { artifactBucket: input.context.traceArtifacts } : {}),
      conversationId: input.conversationId,
      response,
      startedAt,
      ...(input.context.traceDb ? { traceDb: input.context.traceDb } : {}),
      userId: input.context.user.id,
    });
    return response;
  });
}
