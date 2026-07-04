import type { ContractRouterClient } from "@orpc/contract";
import type { JsonifiedClient } from "@orpc/openapi-client";
import { createORPCClient } from "@orpc/client";
import { OpenAPILink } from "@orpc/openapi-client/fetch";
import {
  buildSurfaceIdentityHeaders,
  createSurfaceEngineClient,
  type BuildSurfaceIdentityHeadersInput,
} from "@nudge/surface";
import { apiContract } from "../api-contract";
import { anonymousIdentityHeaders, anonymousUserId } from "./anonymous-identity";
import { currentAppSurface } from "./surface-runtime";

type SessionTokenResolver = () => Promise<string | null>;

let sessionTokenResolver: SessionTokenResolver | null = null;

export function setSessionTokenResolver(resolver: SessionTokenResolver | null) {
  sessionTokenResolver = resolver;
}

export async function nudgeRequestHeaders(input: HeadersInit = {}) {
  const headers = new Headers(input);
  applyHeaders(headers, await surfaceIdentityHeaders());
  return headers;
}

async function surfaceIdentityHeaders() {
  if (sessionTokenResolver) {
    const token = await sessionTokenResolver();
    return token
      ? buildSurfaceIdentityHeaders({ bearerToken: token, surface: currentAppSurface() })
      : buildSurfaceIdentityHeaders({ surface: currentAppSurface() });
  }

  return anonymousIdentityHeaders();
}

function applyHeaders(headers: Headers, values: Readonly<Record<string, string>>) {
  for (const [key, value] of Object.entries(values)) {
    headers.set(key, value);
  }
}

const link = new OpenAPILink(apiContract, {
  fetch: async (request, init) => {
    const headers = await nudgeRequestHeaders(request.headers);
    return fetch(new Request(request, { headers }), init);
  },
  url: () => `${window.location.origin}/api`,
});

export const apiClient: JsonifiedClient<ContractRouterClient<typeof apiContract>> =
  createORPCClient(link);

export async function createWebSurfaceEngineClient(
  input: {
    readonly baseUrl?: string;
    readonly fetch?: (request: Request) => Promise<Response>;
  } = {},
) {
  const identity = await surfaceEngineIdentity();
  return createSurfaceEngineClient({
    ...identity,
    baseUrl: input.baseUrl ?? window.location.origin,
    ...(input.fetch !== undefined ? { fetch: input.fetch } : {}),
  });
}

async function surfaceEngineIdentity(): Promise<BuildSurfaceIdentityHeadersInput> {
  const surface = currentAppSurface();
  if (sessionTokenResolver) {
    const token = await sessionTokenResolver();
    return token ? { bearerToken: token, surface } : { surface };
  }

  return { anonymousUserId: anonymousUserId(), surface };
}

export async function streamConversationMessage(input: {
  readonly conversationId: string;
  readonly events?: boolean;
  readonly message: string;
}) {
  const headers = await nudgeRequestHeaders({
    ...(input.events ? { accept: "text/event-stream" } : {}),
    "content-type": "application/json",
  });
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

  return {
    body: response.body,
    contentType: response.headers.get("content-type") ?? "",
  };
}
