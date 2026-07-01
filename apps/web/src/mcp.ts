import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { type Effect } from "effect";
import { Db, type DbService } from "@vesta/db";
import {
  buildOkfProjection,
  listOkfDirectory,
  PrimitiveWorkflows,
  readOkfFile,
  searchOkfFiles,
} from "@vesta/effect-services";

type VestaMcpContent =
  | { readonly text: string; readonly type: "text" }
  | {
      readonly description: string;
      readonly mimeType: string;
      readonly name: string;
      readonly type: "resource_link";
      readonly uri: string;
    };

const textContent = (content: Extract<VestaMcpContent, { readonly type: "text" }>) => content;
const resourceLinkContent = (
  content: Extract<VestaMcpContent, { readonly type: "resource_link" }>,
) => content;

export async function handleVestaMcpRequest(
  request: Request,
  input: {
    readonly db: DbService;
    readonly runEffect: <A, E>(effect: Effect.Effect<A, E, Db>) => Promise<A>;
    readonly user: { readonly displayName: string; readonly id: string };
    readonly version: string;
  },
) {
  const server = createVestaMcpServer(input);
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

function createVestaMcpServer(input: {
  readonly db: DbService;
  readonly runEffect: <A, E>(effect: Effect.Effect<A, E, Db>) => Promise<A>;
  readonly user: { readonly displayName: string; readonly id: string };
  readonly version: string;
}) {
  const server = new McpServer({ name: "vesta", version: input.version });

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
        frameKey: z.string().min(1).default("current_state"),
        kind: z.enum(["clarify", "follow_up", "commit", "ignore"]),
        rationale: z.string().min(1).max(2_000),
        title: z.string().min(1).max(200),
      },
      outputSchema: {
        proposal: proposalOutputSchema,
        requiresReview: z.literal(true),
      },
    },
    async ({ body, frameKey, kind, rationale, title }) => {
      const { synthesis } = await input.runEffect(
        PrimitiveWorkflows.latestSynthesis({ frameKey, user: input.user }),
      );
      const proposal = await input.runEffect(
        input.db.appendProposal({
          body,
          kind,
          rationale,
          synthesisId: synthesis.id,
          title,
          userId: input.user.id,
        }),
      );
      const structuredContent: {
        readonly proposal: typeof proposal;
        readonly requiresReview: true;
      } = {
        proposal,
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
  id: z.string(),
  kind: z.enum(["clarify", "follow_up", "commit", "ignore"]),
  rationale: z.string(),
  status: z.enum(["pending", "accepted", "edited", "rejected"]),
  synthesisId: z.string(),
  title: z.string(),
  updatedAt: z.string(),
  userId: z.string(),
});

const okfFileUri = (path: string) => `file:///okf${path.startsWith("/") ? path : `/${path}`}`;

const okfPathFromUri = (uri: URL) => {
  if (uri.protocol !== "file:" || !uri.pathname.startsWith("/okf/")) {
    throw new Error(`Unsupported OKF resource URI: ${uri.toString()}`);
  }
  return uri.pathname.slice("/okf".length);
};
