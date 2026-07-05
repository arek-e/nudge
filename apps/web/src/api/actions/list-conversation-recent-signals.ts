import type { z } from "zod";
import { Effect } from "effect";
import type { ApiContext } from "../context";
import type { ApiAction } from "./effect-helpers";
import { listRecentSignalsToolResponseSchema } from "../../api-contract";
import { proxyConversationRequest } from "../../conversation-proxy";

export interface ListConversationRecentSignalsInput {
  readonly context: ApiContext;
  readonly conversationId: string;
  readonly limit?: number;
}

export type ListConversationRecentSignalsResult = z.infer<
  typeof listRecentSignalsToolResponseSchema
>;

export function listConversationRecentSignals(
  input: ListConversationRecentSignalsInput,
): ApiAction<ListConversationRecentSignalsResult> {
  const url = new URL("https://nudge.local/tools/list-recent-signals");
  url.searchParams.set("limit", String(input.limit ?? 10));
  return Effect.tryPromise({
    try: () =>
      proxyConversationRequest(
        input.context.agentSessions,
        input.context.agentInternalSecret,
        input.context.user,
        input.conversationId,
        url,
        listRecentSignalsToolResponseSchema,
        {},
        input.context.traceHeaders,
      ),
    catch: (cause) => cause,
  });
}
