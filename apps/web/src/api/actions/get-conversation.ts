import type { z } from "zod";
import { Effect } from "effect";
import type { ApiContext } from "../context";
import type { ApiAction } from "./effect-helpers";
import { conversationMetadataSchema } from "../../api-contract";
import { proxyConversationRequest } from "../../conversation-proxy";

export interface GetConversationInput {
  readonly context: ApiContext;
  readonly conversationId: string;
}

export type GetConversationResult = z.infer<typeof conversationMetadataSchema>;

export function getConversation(input: GetConversationInput): ApiAction<GetConversationResult> {
  return Effect.tryPromise({
    try: () =>
      proxyConversationRequest(
        input.context.agentSessions,
        input.context.agentInternalSecret,
        input.context.user,
        input.conversationId,
        "/metadata",
        conversationMetadataSchema,
        {},
        input.context.traceHeaders,
      ),
    catch: (cause) => cause,
  });
}
