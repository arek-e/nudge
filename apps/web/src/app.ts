import type { z } from "zod";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { implement, onError } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { Hono } from "hono";
import { Effect, type Layer } from "effect";
import { Db, type DbService } from "@lares/db";
import { AuthService, PrimitiveWorkflows } from "@lares/effect-services";
import type { Env } from "./env";
import {
  apiContract,
  conversationMetadataSchema,
  listRecentSignalsToolResponseSchema,
} from "./api-contract";
import {
  createBetterAuth,
  isBetterAuthConfigured,
  resolveBetterAuthSession,
  type AuthSessionResolver,
} from "./auth";
import {
  addWideEventFields,
  evlogWideEvents,
  type ObservabilityHonoEnv,
  requestObservability,
  retryAfterSecondsFor,
  runWithRequestSpan,
  serverTiming,
} from "./observability";

type AppDbLayer = Layer.Layer<Db>;

interface ApiContext {
  readonly agentSessions: DurableObjectNamespace;
  readonly db: DbService;
  readonly recordSpan: <A>(
    name: string,
    input: {
      readonly attributes?: Readonly<Record<string, unknown>>;
      readonly kind?: "client" | "internal";
    },
    task: () => Promise<A>,
  ) => Promise<A>;
  readonly traceDb?: D1Database;
  readonly session: {
    readonly authMode: "better-auth" | "dev" | "unauthenticated";
    readonly user: {
      readonly id: string;
      readonly displayName: string;
    } | null;
  };
  readonly user: {
    readonly id: string;
    readonly displayName: string;
  };
}

interface CreateAppOptions {
  readonly authSessionResolver?: AuthSessionResolver;
  readonly dbLayer?: AppDbLayer;
}

const api = implement(apiContract).$context<ApiContext>();

export const apiRouter = api.router({
  account: {
    delete: api.account.delete.handler(async ({ context }) => {
      await Effect.runPromise(context.db.deleteUserData({ userId: context.user.id }));
      return { deleted: true };
    }),
  },
  conversations: {
    get: api.conversations.get.handler(async ({ context, input }) => {
      return proxyConversationRequest(
        context.agentSessions,
        input.conversationId,
        "/metadata",
        conversationMetadataSchema,
      );
    }),
    listRecentSignals: api.conversations.listRecentSignals.handler(async ({ context, input }) => {
      const url = new URL("https://lares.local/tools/list-recent-signals");
      url.searchParams.set("limit", String(input.limit ?? 10));
      return proxyConversationRequest(
        context.agentSessions,
        input.conversationId,
        url,
        listRecentSignalsToolResponseSchema,
      );
    }),
  },
  captures: {
    append: api.captures.append.handler(async ({ context, input }) => {
      return runWorkflow(
        context.db,
        PrimitiveWorkflows.appendSignal({
          occurredAt: input.occurredAt,
          payload: input.payload,
          schemaVersion: input.schemaVersion,
          source: input.source,
          type: input.type,
          user: context.user,
          ...(input.idempotencyKey !== undefined ? { idempotencyKey: input.idempotencyKey } : {}),
        }),
      );
    }),
  },
  dataExport: api.dataExport.handler(async ({ context }) => {
    const exported = await Effect.runPromise(context.db.exportUserData(context.user));
    return {
      user: exported.user,
      commitments: [...exported.commitments],
      events: [...exported.events],
      frames: [...exported.frames],
      outcomes: [...exported.outcomes],
      proposals: [...exported.proposals],
      reviews: [...exported.reviews],
      syntheses: exported.syntheses.map((synthesis) => ({
        ...synthesis,
        openQuestions: [...synthesis.openQuestions],
        sourceSignalIds: [...synthesis.sourceSignalIds],
        themes: [...synthesis.themes],
      })),
    };
  }),
  events: {
    append: api.events.append.handler(async ({ context, input }) => {
      return runWorkflow(
        context.db,
        PrimitiveWorkflows.appendSignal({
          occurredAt: input.occurredAt,
          payload: input.payload,
          schemaVersion: input.schemaVersion,
          source: input.source,
          type: input.type,
          user: context.user,
          ...(input.idempotencyKey !== undefined ? { idempotencyKey: input.idempotencyKey } : {}),
        }),
      );
    }),
    list: api.events.list.handler(async ({ context, input }) => {
      const events = await runWorkflow(
        context.db,
        PrimitiveWorkflows.listSignals({
          limit: input.limit ?? 50,
          ...(input.from ? { from: input.from } : {}),
          ...(input.to ? { to: input.to } : {}),
          user: context.user,
        }),
      );

      return { events: [...events] };
    }),
  },
  signals: {
    list: api.signals.list.handler(async ({ context, input }) => {
      const signals = await runWorkflow(
        context.db,
        PrimitiveWorkflows.listSignals({
          limit: input.limit ?? 50,
          ...(input.from ? { from: input.from } : {}),
          ...(input.to ? { to: input.to } : {}),
          user: context.user,
        }),
      );

      return { signals: [...signals] };
    }),
  },
  session: api.session.handler(({ context }) => {
    return {
      authMode: context.session.authMode,
      user: context.session.user,
      workspace: context.session.user
        ? {
            id: context.session.user.id,
            label: `${context.session.user.displayName}'s workspace`,
          }
        : null,
    };
  }),
  proposals: {
    generate: api.proposals.generate.handler(async ({ context, input }) => {
      const proposals = await context.recordSpan(
        "proposals.generate",
        { attributes: { "lares.frame_key": input.frameKey } },
        () =>
          runWorkflow(
            context.db,
            PrimitiveWorkflows.generateProposals({
              frameKey: input.frameKey ?? "current_state",
              user: context.user,
            }),
          ),
      );

      return { proposals: proposals.map(toProposalResponse) };
    }),
    list: api.proposals.list.handler(async ({ context, input }) => {
      const proposals = await runWorkflow(
        context.db,
        PrimitiveWorkflows.listPendingProposals({ limit: input.limit ?? 20, user: context.user }),
      );

      return { proposals: proposals.map(toProposalResponse) };
    }),
  },
  commitments: {
    list: api.commitments.list.handler(async ({ context, input }) => {
      const commitments = await runWorkflow(
        context.db,
        PrimitiveWorkflows.listCommitments({ limit: input.limit ?? 20, user: context.user }),
      );

      return { commitments: [...commitments] };
    }),
  },
  reviews: {
    create: api.reviews.create.handler(async ({ context, input }) => {
      return runWorkflow(
        context.db,
        PrimitiveWorkflows.reviewProposal({
          decision: input.decision,
          ...(input.editedTitle !== undefined ? { editedTitle: input.editedTitle } : {}),
          ...(input.editedBody !== undefined ? { editedBody: input.editedBody } : {}),
          ...(input.editedBodyDocument !== undefined
            ? { editedBodyDocument: input.editedBodyDocument }
            : {}),
          proposalId: input.proposalId,
          user: context.user,
        }),
      );
    }),
  },
  outcomes: {
    list: api.outcomes.list.handler(async ({ context, input }) => {
      const outcomes = await runWorkflow(
        context.db,
        PrimitiveWorkflows.listOutcomes({ limit: input.limit ?? 20, user: context.user }),
      );

      return { outcomes: [...outcomes] };
    }),
    create: api.outcomes.create.handler(async ({ context, input }) => {
      return runWorkflow(
        context.db,
        PrimitiveWorkflows.recordOutcome({
          commitmentId: input.commitmentId,
          ...(input.note !== undefined ? { note: input.note } : {}),
          result: input.result,
          user: context.user,
        }),
      );
    }),
  },
  syntheses: {
    create: api.syntheses.create.handler(async ({ context, input }) => {
      return context.recordSpan(
        "syntheses.create",
        { attributes: { "lares.frame_key": input.frameKey } },
        () =>
          runWorkflow(
            context.db,
            PrimitiveWorkflows.createSynthesis({
              frameKey: input.frameKey ?? "current_state",
              user: context.user,
            }),
          ).then(({ frame, synthesis }) => ({ frame, synthesis: toSynthesisResponse(synthesis) })),
      );
    }),
    latest: api.syntheses.latest.handler(async ({ context, input }) => {
      return context.recordSpan(
        "syntheses.latest",
        { attributes: { "lares.frame_key": input.frameKey } },
        () =>
          runWorkflow(
            context.db,
            PrimitiveWorkflows.latestSynthesis({
              frameKey: input.frameKey ?? "current_state",
              user: context.user,
            }),
          ).then(({ frame, synthesis }) => ({ frame, synthesis: toSynthesisResponse(synthesis) })),
      );
    }),
  },
  traces: {
    recent: api.traces.recent.handler(async ({ context, input }) => {
      const rows = await Effect.runPromise(
        listRecentTraceSpans(context.traceDb, input.limit ?? 20),
      );
      return { spans: rows.map(toTraceSpanSummary) };
    }),
  },
});

async function proxyConversationRequest<Schema extends z.ZodType>(
  agentSessions: DurableObjectNamespace,
  conversationId: string,
  pathOrUrl: string | URL,
  schema: Schema,
): Promise<z.infer<Schema>> {
  const agentId = agentSessions.idFromName(conversationId);
  const agent = agentSessions.get(agentId);
  const url =
    typeof pathOrUrl === "string" ? new URL(`https://lares.local${pathOrUrl}`) : pathOrUrl;
  const response = await agent.fetch(
    new Request(url, {
      headers: { "x-lares-conversation-id": conversationId },
      method: "GET",
    }),
  );

  if (!response.ok) {
    throw new Error(`Conversation agent request failed with ${response.status}`);
  }

  return schema.parse(await response.json());
}

interface TraceSpanRow {
  readonly id: string;
  readonly trace_id: string;
  readonly parent_span_id: string | null;
  readonly name: string;
  readonly kind: string;
  readonly status: string;
  readonly started_at: string;
  readonly ended_at: string | null;
  readonly duration_ms: number | null;
  readonly route_name: string | null;
  readonly method: string | null;
  readonly path: string | null;
}

function listRecentTraceSpans(traceDb: D1Database | undefined, limit: number) {
  if (typeof traceDb?.prepare !== "function") return Effect.succeed([]);

  return Effect.tryPromise({
    try: async () => {
      const result = await traceDb
        .prepare(
          `SELECT
            span_id AS id,
            trace_id,
            parent_span_id,
            name,
            kind,
            status,
            started_at,
            ended_at,
            duration_ms,
            route_name,
            method,
            path
          FROM trace_spans
          WHERE route_name IS NULL OR route_name != 'api.traces'
          ORDER BY started_at DESC
          LIMIT ?`,
        )
        .bind(limit)
        .all<TraceSpanRow>();

      return result.results ?? [];
    },
    catch: (cause) => cause,
  }).pipe(Effect.withSpan("TraceSpans.listRecent", { attributes: { limit } }));
}

function toTraceSpanSummary(row: TraceSpanRow) {
  return {
    id: row.id,
    traceId: row.trace_id,
    parentSpanId: row.parent_span_id,
    name: row.name,
    kind: row.kind,
    status: row.status,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationMs: row.duration_ms,
    routeName: row.route_name,
    method: row.method,
    path: row.path,
  };
}

function toSynthesisResponse(synthesis: {
  readonly id: string;
  readonly userId: string;
  readonly frameId: string;
  readonly summary: string;
  readonly themes: ReadonlyArray<string>;
  readonly openQuestions: ReadonlyArray<string>;
  readonly sourceSignalIds: ReadonlyArray<string>;
  readonly generatedAt: string;
  readonly createdAt: string;
}) {
  return {
    ...synthesis,
    themes: [...synthesis.themes],
    openQuestions: [...synthesis.openQuestions],
    sourceSignalIds: [...synthesis.sourceSignalIds],
  };
}

function toProposalResponse(proposal: {
  readonly id: string;
  readonly userId: string;
  readonly synthesisId: string;
  readonly kind: "clarify" | "follow_up" | "commit" | "ignore";
  readonly status: "pending" | "accepted" | "edited" | "rejected";
  readonly title: string;
  readonly body: string;
  readonly rationale: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}) {
  return proposal;
}

function runWorkflow<A, E>(db: DbService, workflow: Effect.Effect<A, E, Db>) {
  return Effect.runPromise(Effect.provideService(workflow, Db, db));
}

function makeApiHandler() {
  return new OpenAPIHandler(apiRouter, {
    interceptors: [
      onError((error) => {
        const safeError = error instanceof Error ? error : new Error("Unknown API handler error");
        console.warn(
          JSON.stringify({
            event: "api_handler_error",
            logKind: "wide_event",
            service: "lares-web",
            errorType: safeError.name,
            errorMessage: safeError.message,
          }),
        );
      }),
    ],
    plugins: [
      new OpenAPIReferencePlugin({
        docsPath: "/docs",
        docsProvider: "scalar",
        specGenerateOptions: {
          info: {
            title: "Lares API",
            version: "0.1.0",
          },
        },
        schemaConverters: [new ZodToJsonSchemaConverter()],
        specPath: "/openapi.json",
      }),
    ],
  });
}

function resolveDb(layer: AppDbLayer) {
  return Effect.runPromise(
    Effect.provide(
      Effect.gen(function* () {
        return yield* Db;
      }),
      layer,
    ),
  );
}

async function resolveCurrentUser(input: {
  readonly env: Env;
  readonly headers: Headers;
  readonly resolveSession: AuthSessionResolver;
}) {
  const session = await input.resolveSession({ env: input.env, headers: input.headers });
  if (session) {
    const user = {
      displayName: session.user.name ?? session.user.email ?? "Lares User",
      id: session.user.id,
    };
    return {
      authMode: "better-auth" as const,
      user,
    };
  }

  if (isBetterAuthConfigured(input.env)) {
    return {
      authMode: "unauthenticated" as const,
      user: null,
    };
  }

  return {
    authMode: "dev" as const,
    user: await Effect.runPromise(Effect.provide(currentUser, AuthService.layerDev)),
  };
}

const currentUser = Effect.gen(function* () {
  const auth = yield* AuthService;
  return yield* auth.currentUser;
});

export function createApp(options: CreateAppOptions = {}) {
  const app = new Hono<ObservabilityHonoEnv>();
  const apiHandler = makeApiHandler();
  const sharedDb = options.dbLayer ? resolveDb(options.dbLayer) : undefined;
  const resolveSession = options.authSessionResolver ?? resolveBetterAuthSession;

  app.use("*", evlogWideEvents());
  app.use("*", requestObservability());
  app.use("*", serverTiming());

  app.get("/api/version", (c) => {
    addWideEventFields(c, { routeName: "api.version" });
    return c.json({
      service: "lares-web",
      version: c.env.APP_VERSION ?? "0.0.0",
    });
  });

  app.get("/manifest.webmanifest", (c) => {
    addWideEventFields(c, { routeName: "manifest" });
    return c.json({
      name: "Lares",
      short_name: "Lares",
      description: "A private daily operating loop for personal context and follow-through.",
      start_url: "/",
      scope: "/",
      display: "standalone",
      background_color: "#111111",
      theme_color: "#111111",
      icons: [
        {
          src: "/icons/icon.svg",
          sizes: "any",
          type: "image/svg+xml",
          purpose: "any maskable",
        },
      ],
    });
  });

  app.get("/icons/icon.svg", (c) => {
    addWideEventFields(c, { routeName: "pwa.icon" });
    c.header("content-type", "image/svg+xml; charset=utf-8");
    return c.body(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="#111111"/><path d="M256 96c70.7 0 128 57.3 128 128 0 96-128 192-128 192S128 320 128 224c0-70.7 57.3-128 128-128Z" fill="#f4f1eb"/><circle cx="256" cy="224" r="56" fill="#111111"/></svg>`,
    );
  });

  app.post("/__internal/auth/test-account", async (c) => {
    addWideEventFields(c, { routeName: "internal.auth.seed" });
    const configuredSecret = c.env.AUTH_SEED_SECRET;
    const providedSecret = c.req.header("x-lares-seed-secret");
    if (!configuredSecret || providedSecret !== configuredSecret) {
      return c.notFound();
    }

    const body = await c.req.json<{
      readonly email?: string;
      readonly name?: string;
      readonly password?: string;
    }>();
    if (!body.email || !body.name || !body.password) {
      return c.json({ error: "email, name, and password are required" }, 400);
    }

    await createBetterAuth(c.env, { allowSignUpForSeed: true }).api.signUpEmail({
      body: {
        email: body.email,
        name: body.name,
        password: body.password,
      },
    });

    return c.json({ created: true });
  });

  app.on(["GET", "POST"], "/api/auth/*", (c) => {
    addWideEventFields(c, { routeName: "api.auth" });
    if (!isBetterAuthConfigured(c.env)) {
      return c.json({ error: "Better Auth is not configured" }, 503);
    }

    return createBetterAuth(c.env).handler(c.req.raw);
  });

  app.use("/api/*", async (c, next) => {
    if (c.req.path.startsWith("/api/captures")) {
      addWideEventFields(c, { routeName: "api.captures" });
    } else if (c.req.path.startsWith("/api/conversations")) {
      addWideEventFields(c, { routeName: "api.conversations" });
      if (c.req.path.includes("/tools/list-recent-signals")) {
        addWideEventFields(c, { agentTool: "listRecentSignals" });
      }
    } else if (c.req.path.startsWith("/api/signals")) {
      addWideEventFields(c, { routeName: "api.signals" });
    } else if (c.req.path.startsWith("/api/syntheses")) {
      addWideEventFields(c, { routeName: "api.syntheses" });
    } else if (c.req.path.startsWith("/api/proposals")) {
      addWideEventFields(c, { routeName: "api.proposals" });
    } else if (c.req.path.startsWith("/api/commitments")) {
      addWideEventFields(c, { routeName: "api.commitments" });
    } else if (c.req.path.startsWith("/api/reviews")) {
      addWideEventFields(c, { routeName: "api.reviews" });
    } else if (c.req.path.startsWith("/api/outcomes")) {
      addWideEventFields(c, { routeName: "api.outcomes" });
    } else if (c.req.path.startsWith("/api/traces")) {
      addWideEventFields(c, { routeName: "api.traces" });
    } else if (c.req.path.startsWith("/api/events")) {
      addWideEventFields(c, { routeName: "api.events" });
    } else if (c.req.path.startsWith("/api/session")) {
      addWideEventFields(c, { routeName: "api.session" });
    } else if (c.req.path.startsWith("/api/export")) {
      addWideEventFields(c, { routeName: "api.export" });
    } else if (c.req.path.startsWith("/api/account")) {
      addWideEventFields(c, { routeName: "api.account" });
    }

    const db = await runWithRequestSpan(
      c,
      {
        attributes: { "db.system.name": "cloudflare-d1" },
        kind: "client",
        name: "db.resolve",
      },
      () => (sharedDb ? sharedDb : resolveDb(Db.layerD1(c.env.DB))),
    );
    const auth = await runWithRequestSpan(
      c,
      { attributes: { "lares.auth.provider": "better-auth" }, name: "auth.current_user" },
      () => resolveCurrentUser({ env: c.env, headers: c.req.raw.headers, resolveSession }),
    );
    if (!auth.user && !c.req.path.startsWith("/api/session")) {
      return c.json({ error: "Authentication required" }, 401);
    }

    const user = auth.user ?? { displayName: "Unauthenticated", id: "unauthenticated" };
    const recordSpan: ApiContext["recordSpan"] = (name, input, task) =>
      runWithRequestSpan(c, { ...input, name }, task);
    const result = await runWithRequestSpan(
      c,
      { attributes: { "rpc.system": "orpc" }, name: "orpc.handle" },
      () =>
        apiHandler.handle(c.req.raw, {
          context: {
            agentSessions: c.env.USER_AGENT_SESSION,
            db,
            recordSpan,
            session: auth,
            traceDb: c.env.DB,
            user,
          },
          prefix: "/api",
        }),
    );

    if (result.matched) {
      return c.newResponse(result.response.body, result.response);
    }

    await next();
  });

  app.onError((error, c) => {
    const retryAfterSeconds = retryAfterSecondsFor(error);
    const status = retryAfterSeconds === null ? 500 : 503;
    addWideEventFields(c, {
      status,
      outcome: "error",
      errorType: error.name,
      errorMessage: error.message,
      ...(retryAfterSeconds !== null
        ? { retryAfterSeconds, resilienceKind: "transient_backpressure" }
        : {}),
    });

    if (retryAfterSeconds !== null) {
      c.header("Retry-After", String(retryAfterSeconds));
      return c.json({ error: "Service temporarily unavailable", retryAfterSeconds }, 503);
    }

    return c.json({ error: "Internal Server Error" }, status);
  });

  app.get("/", (c) => {
    addWideEventFields(c, { routeName: "today" });

    return c.html(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#111111" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-title" content="Lares" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="icon" href="/icons/icon.svg" />
    <title>Lares Daily Operating Loop</title>
    <style>
      :root {
        color-scheme: dark;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #0d1117;
        color: #f4efe8;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        background:
          radial-gradient(circle at top left, rgba(196, 167, 111, 0.24), transparent 30rem),
          linear-gradient(180deg, #15120f 0%, #0d1117 52%, #080a0f 100%);
      }
      main {
        width: min(100%, 44rem);
        margin: 0 auto;
        padding: max(1rem, env(safe-area-inset-top)) 1rem max(2rem, env(safe-area-inset-bottom));
      }
      header {
        padding: 1.5rem 0 1rem;
      }
      .eyebrow {
        margin: 0 0 0.5rem;
        color: #c4a76f;
        font-size: 0.8rem;
        font-weight: 700;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }
      h1 {
        margin: 0;
        font-size: clamp(2.3rem, 13vw, 4.8rem);
        line-height: 0.9;
        letter-spacing: -0.08em;
      }
      .summary {
        margin: 1rem 0 0;
        color: #c9d1d9;
        font-size: 1.05rem;
        line-height: 1.55;
      }
      .card {
        margin-top: 1rem;
        padding: 1rem;
        border: 1px solid rgba(244, 239, 232, 0.14);
        border-radius: 1.5rem;
        background: rgba(13, 17, 23, 0.72);
        box-shadow: 0 1.25rem 4rem rgba(0, 0, 0, 0.28);
        backdrop-filter: blur(18px);
      }
      label {
        display: block;
        margin-bottom: 0.5rem;
        font-weight: 750;
      }
      textarea {
        width: 100%;
        min-height: 9rem;
        resize: vertical;
        border: 1px solid rgba(244, 239, 232, 0.18);
        border-radius: 1rem;
        padding: 0.9rem;
        background: rgba(255, 255, 255, 0.06);
        color: inherit;
        font: inherit;
        line-height: 1.45;
      }
      button, a.button {
        display: inline-flex;
        min-height: 3rem;
        align-items: center;
        justify-content: center;
        border: 0;
        border-radius: 999px;
        padding: 0 1rem;
        background: #c4a76f;
        color: #15120f;
        font: inherit;
        font-weight: 800;
        text-decoration: none;
      }
      .actions {
        display: grid;
        grid-template-columns: 1fr;
        gap: 0.75rem;
        margin-top: 0.9rem;
      }
      .secondary {
        background: rgba(244, 239, 232, 0.1) !important;
        color: #f4efe8 !important;
      }
      #status {
        min-height: 1.5rem;
        margin: 0.85rem 0 0;
        color: #c9d1d9;
      }
      ul {
        display: grid;
        gap: 0.75rem;
        margin: 0;
        padding: 0;
        list-style: none;
      }
      li {
        border: 1px solid rgba(244, 239, 232, 0.1);
        border-radius: 1rem;
        padding: 0.85rem;
        background: rgba(255, 255, 255, 0.04);
      }
      .event-type {
        color: #c4a76f;
        font-size: 0.78rem;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .event-note {
        margin-top: 0.35rem;
        line-height: 1.45;
        overflow-wrap: anywhere;
      }
      @media (min-width: 40rem) {
        main { padding-inline: 1.5rem; }
        .actions { grid-template-columns: 1fr 1fr; }
      }
    </style>
  </head>
  <body>
    <main>
      <header>
        <p class="eyebrow">Lares</p>
        <h1>Daily Operating Loop</h1>
        <p class="summary">Your private operating layer for what changed, what matters now, and what Lares should remember before it helps you act.</p>
      </header>

      <section class="card" aria-labelledby="today-title">
        <p class="eyebrow">Today</p>
        <h2 id="today-title">Start with the current state</h2>
        <p class="summary">Capture priorities, constraints, energy, and follow-ups. Lares stores this as user-owned context for the Daily Operating Loop.</p>
      </section>

      <section class="card" aria-labelledby="check-in-title">
        <h2 id="check-in-title">Morning check-in</h2>
        <form id="check-in-form">
          <label for="note">What should Lares know this morning?</label>
          <textarea id="note" name="note" autocomplete="off" placeholder="Priorities, energy, constraints, people to follow up with..."></textarea>
          <div class="actions">
            <button type="submit">Save check-in</button>
            <a class="button secondary" href="/api/docs">API docs</a>
          </div>
          <p id="status" role="status"></p>
        </form>
      </section>

      <section class="card" aria-labelledby="events-title">
        <h2 id="events-title">Recent events</h2>
        <ul id="events"><li>Loading events...</li></ul>
      </section>
    </main>
    <script>
      const form = document.querySelector('#check-in-form');
      const note = document.querySelector('#note');
      const status = document.querySelector('#status');
      const events = document.querySelector('#events');

      async function loadEvents() {
        const response = await fetch('/api/events');
        const body = await response.json();
        events.innerHTML = '';
        if (!body.events.length) {
          events.innerHTML = '<li>No events yet. Save the first check-in.</li>';
          return;
        }
        for (const event of body.events) {
          const item = document.createElement('li');
          const text = event.payload && typeof event.payload.note === 'string' ? event.payload.note : JSON.stringify(event.payload);
          item.innerHTML = '<div class="event-type"></div><div class="event-note"></div>';
          item.querySelector('.event-type').textContent = event.type;
          item.querySelector('.event-note').textContent = text;
          events.append(item);
        }
      }

      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        status.textContent = 'Saving...';
        const value = note.value.trim();
        if (!value) {
          status.textContent = 'Write a short check-in first.';
          return;
        }
        const response = await fetch('/api/events', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            type: 'manual_check_in_submitted',
            source: 'today_app',
            occurredAt: new Date().toISOString(),
            schemaVersion: 1,
            payload: { note: value },
          }),
        });
        if (!response.ok) {
          status.textContent = 'Could not save. Check the deployment logs.';
          return;
        }
        note.value = '';
        status.textContent = 'Saved. This is now in the user-owned event log.';
        await loadEvents();
      });

      loadEvents().catch(() => {
        events.innerHTML = '<li>Could not load events. Check the deployment logs.</li>';
      });
    </script>
  </body>
</html>`);
  });

  app.get("/health", (c) => {
    const env = c.env;
    addWideEventFields(c, { routeName: "health" });

    return c.json({
      ok: true,
      service: "lares-web",
      environment: env.ENVIRONMENT ?? "unknown",
      version: env.APP_VERSION ?? "0.0.0",
      bindings: {
        d1: Boolean(env.DB),
        dailyDigestWorkflow: Boolean(env.DAILY_DIGEST_WORKFLOW),
        userAgentSession: Boolean(env.USER_AGENT_SESSION),
      },
    });
  });

  app.get("/__test/error", (c) => {
    if (c.env.ENVIRONMENT !== "test") {
      return c.notFound();
    }

    addWideEventFields(c, { routeName: "test.error" });
    if (c.req.query("kind") === "transient") {
      throw new Error("D1_ERROR: database is locked");
    }
    throw new Error("test failure");
  });

  return app;
}
