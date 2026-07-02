import type { ContractRouterClient } from "@orpc/contract";
import type { JsonifiedClient } from "@orpc/openapi-client";
import { createORPCClient } from "@orpc/client";
import { OpenAPILink } from "@orpc/openapi-client/fetch";
import { apiContract } from "../api-contract";
import { anonymousIdentityHeaders } from "./anonymous-identity";

type SessionTokenResolver = () => Promise<string | null>;

let sessionTokenResolver: SessionTokenResolver | null = null;

export function setSessionTokenResolver(resolver: SessionTokenResolver | null) {
  sessionTokenResolver = resolver;
}

async function vestaRequestHeaders(input: HeadersInit = {}) {
  const headers = new Headers(input);
  if (sessionTokenResolver) {
    const token = await sessionTokenResolver();
    if (token) {
      headers.set("authorization", `Bearer ${token}`);
    }
    return headers;
  }

  const identityHeaders = anonymousIdentityHeaders();
  headers.set("x-vesta-anonymous-user-id", identityHeaders["x-vesta-anonymous-user-id"]);
  headers.set("x-vesta-client", identityHeaders["x-vesta-client"]);
  return headers;
}

const link = new OpenAPILink(apiContract, {
  fetch: async (request, init) => {
    const headers = await vestaRequestHeaders(request.headers);
    return fetch(new Request(request, { headers }), init);
  },
  url: () => `${window.location.origin}/api`,
});

export const apiClient: JsonifiedClient<ContractRouterClient<typeof apiContract>> =
  createORPCClient(link);

export async function streamConversationMessage(input: {
  readonly conversationId: string;
  readonly message: string;
}) {
  const headers = await vestaRequestHeaders({ "content-type": "application/json" });
  const response = await fetch(
    `/api/conversations/${encodeURIComponent(input.conversationId)}/messages/stream`,
    {
      body: JSON.stringify({ message: input.message }),
      headers,
      method: "POST",
    },
  );

  if (!response.ok || !response.body) {
    throw new Error("Could not stream conversation message");
  }

  return response.body;
}
