import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { type Effect } from "effect";
import { Db, type DbService } from "@nudge/db";
import {
  buildOkfProjection,
  listOkfDirectory,
  PrimitiveWorkflows,
  readOkfFile,
  searchOkfFiles,
} from "@nudge/effect-services";

type NudgeMcpContent =
  | { readonly text: string; readonly type: "text" }
  | {
      readonly description: string;
      readonly mimeType: string;
      readonly name: string;
      readonly type: "resource_link";
      readonly uri: string;
    };

const textContent = (content: Extract<NudgeMcpContent, { readonly type: "text" }>) => content;
const resourceLinkContent = (
  content: Extract<NudgeMcpContent, { readonly type: "resource_link" }>,
) => content;

export async function handleNudgeMcpRequest(
  request: Request,
  input: {
    readonly db: DbService;
    readonly runEffect: <A, E>(effect: Effect.Effect<A, E, Db>) => Promise<A>;
    readonly user: { readonly displayName: string; readonly id: string };
    readonly version: string;
  },
) {
  const server = createNudgeMcpServer(input);
  const transport = new WebStandardStreamableHTTPServerTransport({
    enableJsonResponse: true,
  });
  await server.connect(transport);
  try {
    return await transport.handleRequest(request);
  } finally {
    await transport.close();
    await server.close();
  }
}

function createNudgeMcpServer(input: {
  readonly db: DbService;
  readonly runEffect: <A, E>(effect: Effect.Effect<A, E, Db>) => Promise<A>;
  readonly user: { readonly displayName: string; readonly id: string };
  readonly version: string;
}) {
  const server = new McpServer({ name: "nudge", version: input.version });

  server.registerResource(
    "okf_files",
    new ResourceTemplate("file:///okf/{+path}", {
      list: async () => {
        const exported = await input.runEffect(input.db.exportUserData(input.user));
        const projection = buildOkfProjection(exported);
        return {
          resources: [...projection.files.keys()].map((path) => ({
            mimeType: "text/markdown",
            name: path,
            uri: okfFileUri(path),
          })),
        };
      },
    }),
    {
      description: "Read-only OKF workspace files for the current user.",
      mimeType: "text/markdown",
    },
    async (uri) => {
      const exported = await input.runEffect(input.db.exportUserData(input.user));
      const projection = buildOkfProjection(exported);
      return {
        contents: [
          {
            mimeType: "text/markdown",
            text: readOkfFile(projection, okfPathFromUri(uri)),
            uri: uri.toString(),
          },
        ],
      };
    },
  );

  server.registerTool(
    "okf_list",
    {
      description: "List entries in the user's read-only OKF workspace projection.",
      inputSchema: { path: z.string().min(1).default("/") },
    },
    async ({ path }) => {
      const exported = await input.runEffect(input.db.exportUserData(input.user));
      const projection = buildOkfProjection(exported);
      return {
        content: [{ text: JSON.stringify(listOkfDirectory(projection, path)), type: "text" }],
      };
    },
  );

  server.registerTool(
    "okf_read",
    {
      description: "Read one Markdown file from the user's read-only OKF workspace projection.",
      inputSchema: { path: z.string().min(1) },
    },
    async ({ path }) => {
      const exported = await input.runEffect(input.db.exportUserData(input.user));
      const projection = buildOkfProjection(exported);
      return { content: [{ text: readOkfFile(projection, path), type: "text" }] };
    },
  );

  server.registerTool(
    "okf_search",
    {
      description: "Search the user's read-only OKF workspace projection.",
      inputSchema: {
        limit: z.number().int().min(1).max(50).default(10),
        query: z.string().min(1).max(1_000),
      },
      outputSchema: {
        results: z.array(z.object({ path: z.string(), snippet: z.string() })),
      },
    },
    async ({ limit, query }) => {
      const exported = await input.runEffect(input.db.exportUserData(input.user));
      const projection = buildOkfProjection(exported);
      const results = searchOkfFiles(projection, query, limit);
      const enrichedResults = results.map((result) => ({
        ...result,
        mimeType: "text/markdown",
        uri: okfFileUri(result.path),
      }));
      return {
        content: [
          textContent({
            text: JSON.stringify({ limit, query, results: enrichedResults }),
            type: "text",
          }),
          ...enrichedResults.map((result) =>
            resourceLinkContent({
              description: result.snippet,
              mimeType: result.mimeType,
              name: result.path.split("/").at(-1) ?? result.path,
              type: "resource_link",
              uri: result.uri,
            }),
          ),
        ],
        structuredContent: { limit, query, results: enrichedResults },
      };
    },
  );

  server.registerTool(
    "proposal_write",
    {
      description: "Create a pending proposal for user review. This never commits the proposal.",
      inputSchema: {
        body: z.string().min(1).max(10_000),
        confidence: z.number().min(0).max(1).optional(),
        frameKey: z.string().min(1).default("current_state"),
        kind: z.enum(["clarify", "follow_up", "commit", "ignore"]),
        nextAction: z.string().min(1).max(500).optional(),
        rationale: z.string().min(1).max(2_000),
        reason: z.string().min(1).max(2_000).optional(),
        sourceSignalIds: z.array(z.string().min(1)).default([]),
        title: z.string().min(1).max(200),
      },
      outputSchema: {
        proposal: proposalOutputSchema,
        receipt: agentReceiptOutputSchema,
        requiresReview: z.literal(true),
      },
    },
    async ({
      body,
      confidence,
      frameKey,
      kind,
      nextAction,
      rationale,
      reason,
      sourceSignalIds,
      title,
    }) => {
      const { synthesis } = await input.runEffect(
        PrimitiveWorkflows.latestSynthesis({ frameKey, user: input.user }),
      );
      const signalIds =
        sourceSignalIds.length > 0 ? sourceSignalIds : [...synthesis.sourceSignalIds];
      const proposalReason = reason ?? rationale;
      const proposal = await input.runEffect(
        input.db.appendProposal({
          body,
          kind,
          rationale: proposalReason,
          synthesisId: synthesis.id,
          title,
          userId: input.user.id,
        }),
      );
      const explanation = {
        source: {
          label: `${signalIds.length} signal${signalIds.length === 1 ? "" : "s"}`,
          signalIds,
          type: "signals",
        },
        reason: proposalReason,
        confidence: confidence ?? 0.74,
        nextAction: nextAction ?? "Review this proposal.",
      };
      const receiptEvent = await input.runEffect(
        input.db.appendEvent({
          idempotencyKey: `agent-receipt:proposal.generated:${proposal.id}`,
          occurredAt: new Date().toISOString(),
          payload: {
            action: "proposal.generated",
            changed: {
              proposalId: proposal.id,
              status: proposal.status,
              title: proposal.title,
            },
            signalIds,
            why: proposalReason,
          },
          schemaVersion: 1,
          source: "nudge_mcp",
          type: "agent.receipt",
          userId: input.user.id,
        }),
      );
      const receipt = {
        id: receiptEvent.id,
        action: "proposal.generated",
        changed: {
          proposalId: proposal.id,
          status: proposal.status,
          title: proposal.title,
        },
        createdAt: receiptEvent.createdAt,
        signalIds,
        why: proposalReason,
      };
      const structuredContent: {
        readonly proposal: typeof proposal & { readonly explanation: typeof explanation };
        readonly receipt: typeof receipt;
        readonly requiresReview: true;
      } = {
        proposal: { ...proposal, explanation },
        receipt,
        requiresReview: true,
      };
      return {
        content: [{ text: JSON.stringify(structuredContent), type: "text" }],
        structuredContent,
      };
    },
  );

  return server;
}

const proposalOutputSchema = z.object({
  body: z.string(),
  createdAt: z.string(),
  explanation: z.object({
    confidence: z.number(),
    nextAction: z.string(),
    reason: z.string(),
    source: z.object({
      label: z.string(),
      signalIds: z.array(z.string()),
      type: z.literal("signals"),
    }),
  }),
  id: z.string(),
  kind: z.enum(["clarify", "follow_up", "commit", "ignore"]),
  rationale: z.string(),
  status: z.enum(["pending", "accepted", "edited", "rejected"]),
  synthesisId: z.string(),
  title: z.string(),
  updatedAt: z.string(),
  userId: z.string(),
});

const agentReceiptOutputSchema = z.object({
  id: z.string(),
  action: z.string(),
  changed: z.record(z.string(), z.unknown()),
  createdAt: z.string(),
  signalIds: z.array(z.string()),
  why: z.string(),
});

const okfFileUri = (path: string) => `file:///okf${path.startsWith("/") ? path : `/${path}`}`;

const okfPathFromUri = (uri: URL) => {
  if (uri.protocol !== "file:" || !uri.pathname.startsWith("/okf/")) {
    throw new Error(`Unsupported OKF resource URI: ${uri.toString()}`);
  }
  return uri.pathname.slice("/okf".length);
};
