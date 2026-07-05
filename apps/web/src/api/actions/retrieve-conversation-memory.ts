import type { z } from "zod";
import { Effect } from "effect";
import type { ApiContext } from "../context";
import type { ApiAction } from "./effect-helpers";
import { retrieveMemoryToolResponseSchema } from "../../api-contract";
import { proxyConversationRequest } from "../../conversation-proxy";

export interface RetrieveConversationMemoryInput {
  readonly context: ApiContext;
  readonly conversationId: string;
  readonly limit?: number;
  readonly query: string;
}

export type RetrieveConversationMemoryResult = z.infer<typeof retrieveMemoryToolResponseSchema>;

export function retrieveConversationMemory(
  input: RetrieveConversationMemoryInput,
): ApiAction<RetrieveConversationMemoryResult> {
  const url = new URL("https://nudge.local/tools/retrieve-memory");
  url.searchParams.set("query", input.query);
  url.searchParams.set("limit", String(input.limit ?? 5));
  return Effect.tryPromise({
    try: () =>
      proxyConversationRequest(
        input.context.agentSessions,
        input.context.agentInternalSecret,
        input.context.user,
        input.conversationId,
        url,
        retrieveMemoryToolResponseSchema,
        {},
        input.context.traceHeaders,
      ),
    catch: (cause) => cause,
  });
}
