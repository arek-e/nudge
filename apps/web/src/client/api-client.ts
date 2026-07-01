import type { ContractRouterClient } from "@orpc/contract";
import type { JsonifiedClient } from "@orpc/openapi-client";
import { createORPCClient } from "@orpc/client";
import { OpenAPILink } from "@orpc/openapi-client/fetch";
import { apiContract } from "../api-contract";

const link = new OpenAPILink(apiContract, {
  url: () => `${window.location.origin}/api`,
});

export const apiClient: JsonifiedClient<ContractRouterClient<typeof apiContract>> =
  createORPCClient(link);

export async function streamConversationMessage(input: {
  readonly conversationId: string;
  readonly message: string;
}) {
  const response = await fetch(
    `/api/conversations/${encodeURIComponent(input.conversationId)}/messages/stream`,
    {
      body: JSON.stringify({ message: input.message }),
      headers: { "content-type": "application/json" },
      method: "POST",
    },
  );

  if (!response.ok || !response.body) {
    throw new Error("Could not stream conversation message");
  }

  return response.body;
}
