import { z } from "zod";
import type { NudgeUser } from "./Services/NudgeApp";
import { conversationMessageResponseSchema } from "./api-contract";

type ConversationMessageResponse = z.infer<typeof conversationMessageResponseSchema>;

export async function proxyConversationRequest<Schema extends z.ZodType>(
  agentSessions: DurableObjectNamespace,
  internalSecret: string | undefined,
  user: NudgeUser,
  conversationId: string,
  pathOrUrl: string | URL,
  schema: Schema,
  init: { readonly body?: BodyInit; readonly method?: string } = {},
  traceHeaders: Readonly<Record<string, string>> = {},
): Promise<z.infer<Schema>> {
  const agentId = agentSessions.idFromName(`${user.id}:${conversationId}`);
  const agent = agentSessions.get(agentId);
  const url =
    typeof pathOrUrl === "string" ? new URL(`https://nudge.local${pathOrUrl}`) : pathOrUrl;
  const internalSignature = internalSecret
    ? await signAgentRequest(internalSecret, user.id, conversationId)
    : undefined;
  const requestInit = {
    headers: {
      "content-type": "application/json",
      ...traceHeaders,
      "x-nudge-conversation-id": conversationId,
      "x-nudge-user-display-name": user.displayName,
      "x-nudge-user-id": user.id,
      ...(internalSignature !== undefined
        ? { "x-nudge-internal-signature": internalSignature }
        : {}),
    },
    method: init.method ?? "GET",
    ...(init.body !== undefined ? { body: init.body } : {}),
  } satisfies RequestInit;
  const response = await agent.fetch(new Request(url.toString(), requestInit));

  if (!response.ok) {
    throw new Error(`Conversation agent request failed with ${response.status}`);
  }

  return schema.parse(await response.json());
}

export function conversationStreamPath(path: string) {
  const match = /^\/api\/conversations\/([^/]+)\/messages\/stream$/.exec(path);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export async function proxyConversationStream(
  agentSessions: DurableObjectNamespace,
  internalSecret: string | undefined,
  user: NudgeUser,
  conversationId: string,
  message: string,
  traceHeaders: Readonly<Record<string, string>> = {},
  accept?: string,
): Promise<Response> {
  if (accept?.includes("text/event-stream")) {
    const response = await proxyConversationRequest(
      agentSessions,
      internalSecret,
      user,
      conversationId,
      "/messages",
      conversationMessageResponseSchema,
      {
        body: JSON.stringify({ message }),
        method: "POST",
      },
      traceHeaders,
    );
    return conversationMessageEventStream(response);
  }

  const agentId = agentSessions.idFromName(`${user.id}:${conversationId}`);
  const agent = agentSessions.get(agentId);
  const internalSignature = internalSecret
    ? await signAgentRequest(internalSecret, user.id, conversationId)
    : undefined;
  const response = await agent.fetch(
    new Request("https://nudge.local/messages/stream", {
      body: JSON.stringify({ message }),
      headers: {
        ...(accept ? { accept } : {}),
        "content-type": "application/json",
        ...traceHeaders,
        "x-nudge-conversation-id": conversationId,
        "x-nudge-user-display-name": user.displayName,
        "x-nudge-user-id": user.id,
        ...(internalSignature !== undefined
          ? { "x-nudge-internal-signature": internalSignature }
          : {}),
      },
      method: "POST",
    }),
  );

  if (!response.ok) {
    throw new Error(`Conversation agent stream failed with ${response.status}`);
  }

  return response;
}

function conversationMessageEventStream(input: ConversationMessageResponse) {
  const frames = [
    sseFrame("progress", {
      id: "read-context",
      kind: "tool",
      label: "Reading workspace context",
      status: "complete",
    }),
    sseFrame("sources", {
      memoryResults: input.memoryResults.map((result) => ({
        sourceId: result.sourceId,
        sourceType: result.sourceType,
      })),
      signalIds: input.draft ? [input.draft.signal.id] : [],
    }),
    sseFrame("progress", {
      id: "draft-proposal",
      kind: "tool",
      label: "Drafting review proposal",
      status: input.draft ? "complete" : "error",
    }),
    ...(input.receipt ? [sseFrame("receipt", input.receipt)] : []),
    sseFrame("token", { text: input.reply }),
    sseFrame("done", { ok: true }),
  ];
  return new Response(frames.join(""), {
    headers: {
      "cache-control": "no-cache",
      "content-type": "application/x-nudge-event-stream; charset=utf-8",
      "x-nudge-conversation-id": input.conversationId,
    },
  });
}

function sseFrame(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

async function signAgentRequest(secret: string, userId: string, conversationId: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${userId}:${conversationId}`),
  );
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
