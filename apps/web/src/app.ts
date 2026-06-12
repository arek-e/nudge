import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { implement, onError } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { Hono } from "hono";
import { Effect, type Layer } from "effect";
import { Db, type DbService } from "@lares/db";
import { AuthService } from "@lares/effect-services";
import type { Env } from "./env";
import { apiContract } from "./api-contract";
import { addWideEventFields, requestObservability, serverTiming } from "./observability";

type AppDbLayer = Layer.Layer<Db>;

interface ApiContext {
  readonly db: DbService;
  readonly user: {
    readonly id: string;
    readonly displayName: string;
  };
}

interface CreateAppOptions {
  readonly dbLayer?: AppDbLayer;
}

const api = implement(apiContract).$context<ApiContext>();

export const apiRouter = api.router({
  captures: {
    append: api.captures.append.handler(async ({ context, input }) => {
      return runWithDb(context.db, function* () {
        yield* context.db.ensureUser(context.user);
        return yield* context.db.appendEvent({ ...input, userId: context.user.id });
      });
    }),
  },
  events: {
    append: api.events.append.handler(async ({ context, input }) => {
      return runWithDb(context.db, function* () {
        yield* context.db.ensureUser(context.user);
        return yield* context.db.appendEvent({ ...input, userId: context.user.id });
      });
    }),
    list: api.events.list.handler(async ({ context, input }) => {
      const events = await runWithDb(context.db, function* () {
        yield* context.db.ensureUser(context.user);
        const query = {
          userId: context.user.id,
          limit: input.limit,
          ...(input.from ? { occurredFrom: input.from } : {}),
          ...(input.to ? { occurredTo: input.to } : {}),
        };
        return yield* context.db.listRecentEvents(query);
      });

      return { events: [...events] };
    }),
  },
  signals: {
    list: api.signals.list.handler(async ({ context, input }) => {
      const signals = await runWithDb(context.db, function* () {
        yield* context.db.ensureUser(context.user);
        const query = {
          userId: context.user.id,
          limit: input.limit,
          ...(input.from ? { occurredFrom: input.from } : {}),
          ...(input.to ? { occurredTo: input.to } : {}),
        };
        return yield* context.db.listRecentEvents(query);
      });

      return { signals: [...signals] };
    }),
  },
  proposals: {
    generate: api.proposals.generate.handler(async ({ context, input }) => {
      const proposals = await runWithDb(context.db, function* () {
        yield* context.db.ensureUser(context.user);
        const frame = yield* ensureFrame(context.db, context.user.id, input.frameKey);
        const synthesis = yield* context.db.getLatestSynthesis({
          userId: context.user.id,
          frameId: frame.id,
        });
        if (!synthesis) return [];

        const proposalInputs = buildDeterministicProposals({
          userId: context.user.id,
          synthesisId: synthesis.id,
          openQuestions: synthesis.openQuestions,
          themes: synthesis.themes,
        });
        const created = [];
        for (const proposalInput of proposalInputs) {
          created.push(yield* context.db.appendProposal(proposalInput));
        }
        return created;
      });

      return { proposals: proposals.map(toProposalResponse) };
    }),
    list: api.proposals.list.handler(async ({ context, input }) => {
      const proposals = await runWithDb(context.db, function* () {
        yield* context.db.ensureUser(context.user);
        return yield* context.db.listPendingProposals({
          userId: context.user.id,
          limit: input.limit,
        });
      });

      return { proposals: proposals.map(toProposalResponse) };
    }),
  },
  reviews: {
    create: api.reviews.create.handler(async ({ context, input }) => {
      return runWithDb(context.db, function* () {
        yield* context.db.ensureUser(context.user);
        return yield* context.db.reviewProposal({
          userId: context.user.id,
          proposalId: input.proposalId,
          decision: input.decision,
          ...(input.editedTitle ? { editedTitle: input.editedTitle } : {}),
          ...(input.editedBody ? { editedBody: input.editedBody } : {}),
        });
      });
    }),
  },
  syntheses: {
    create: api.syntheses.create.handler(async ({ context, input }) => {
      return runWithDb(context.db, function* () {
        yield* context.db.ensureUser(context.user);
        const frame = yield* context.db.upsertCurrentFrame(
          defaultFrame(context.user.id, input.frameKey),
        );
        const signals = yield* context.db.listRecentEvents({
          userId: context.user.id,
          limit: 20,
        });
        const synthesisInput = buildDeterministicSynthesis({
          userId: context.user.id,
          frameId: frame.id,
          signals,
        });
        const synthesis = yield* context.db.appendSynthesis(synthesisInput);
        return { frame, synthesis: toSynthesisResponse(synthesis) };
      });
    }),
    latest: api.syntheses.latest.handler(async ({ context, input }) => {
      return runWithDb(context.db, function* () {
        yield* context.db.ensureUser(context.user);
        const frame = yield* ensureFrame(context.db, context.user.id, input.frameKey);
        const latest = yield* context.db.getLatestSynthesis({
          userId: context.user.id,
          frameId: frame.id,
        });
        if (latest) return { frame, synthesis: toSynthesisResponse(latest) };

        const signals = yield* context.db.listRecentEvents({
          userId: context.user.id,
          limit: 20,
        });
        const synthesis = yield* context.db.appendSynthesis(
          buildDeterministicSynthesis({ userId: context.user.id, frameId: frame.id, signals }),
        );
        return { frame, synthesis: toSynthesisResponse(synthesis) };
      });
    }),
  },
});

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

function defaultFrame(userId: string, key: string) {
  return {
    userId,
    key,
    title: key === "current_state" ? "What matters now?" : key,
    prompt: "Synthesize recent signals into current context.",
  };
}

function ensureFrame(db: DbService, userId: string, key: string) {
  return Effect.gen(function* () {
    const current = yield* db.getCurrentFrame({ userId, key });
    if (current) return current;
    return yield* db.upsertCurrentFrame(defaultFrame(userId, key));
  });
}

function buildDeterministicSynthesis(input: {
  readonly userId: string;
  readonly frameId: string;
  readonly signals: ReadonlyArray<{
    readonly id: string;
    readonly payload: unknown;
    readonly type: string;
  }>;
}) {
  const latestNote = noteFromPayload(input.signals[0]?.payload);
  const themes = [...new Set(input.signals.flatMap((signal) => themesFromSignal(signal)))];

  return {
    userId: input.userId,
    frameId: input.frameId,
    summary:
      input.signals.length === 0
        ? "No recent signals captured."
        : `${input.signals.length} signal${input.signals.length === 1 ? "" : "s"} captured. Latest: ${latestNote}`,
    themes: themes.length > 0 ? themes : ["current-context"],
    openQuestions: ["What needs attention next?"],
    sourceSignalIds: input.signals.map((signal) => signal.id),
  };
}

function buildDeterministicProposals(input: {
  readonly userId: string;
  readonly synthesisId: string;
  readonly openQuestions: ReadonlyArray<string>;
  readonly themes: ReadonlyArray<string>;
}) {
  const [firstQuestion] = input.openQuestions;
  if (firstQuestion) {
    return [
      {
        userId: input.userId,
        synthesisId: input.synthesisId,
        kind: "clarify" as const,
        title: "Clarify next attention point",
        body: `Answer: ${firstQuestion}`,
        rationale: "Created from an open question in the synthesis.",
      },
    ];
  }

  if (input.themes.includes("travel")) {
    return [
      {
        userId: input.userId,
        synthesisId: input.synthesisId,
        kind: "follow_up" as const,
        title: "Review travel constraints",
        body: "Check whether travel changes what needs attention next.",
        rationale: "Created from a travel theme in the synthesis.",
      },
    ];
  }

  return [
    {
      userId: input.userId,
      synthesisId: input.synthesisId,
      kind: "clarify" as const,
      title: "Capture more context",
      body: "Add another capture so Lares has enough context to help.",
      rationale: "Created because there were no open questions or specific themes.",
    },
  ];
}

function noteFromPayload(payload: unknown) {
  if (
    payload &&
    typeof payload === "object" &&
    "note" in payload &&
    typeof payload.note === "string"
  ) {
    return payload.note;
  }

  return "No note available";
}

function themesFromSignal(signal: { readonly payload: unknown; readonly type: string }) {
  const note = noteFromPayload(signal.payload).toLowerCase();
  const themes = [];
  if (note.includes("travel") || note.includes("traveling")) themes.push("travel");
  if (note.includes("follow up") || note.includes("follow-up")) themes.push("follow-up");
  if (note.includes("work") || signal.type.includes("work")) themes.push("work");
  return themes;
}

function runWithDb<A>(db: DbService, f: () => Generator<Effect.Effect<any>, A, any>) {
  return Effect.runPromise(Effect.provideService(Effect.gen(f), Db, db));
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

function resolveCurrentUser() {
  return Effect.runPromise(Effect.provide(currentUser, AuthService.layerDev));
}

const currentUser = Effect.gen(function* () {
  const auth = yield* AuthService;
  return yield* auth.currentUser;
});

export function createApp(options: CreateAppOptions = {}) {
  const app = new Hono<{ Bindings: Env }>();
  const apiHandler = makeApiHandler();
  const sharedDb = options.dbLayer ? resolveDb(options.dbLayer) : undefined;

  app.use("*", requestObservability());
  app.use("*", serverTiming());

  app.use("/api/*", async (c, next) => {
    if (c.req.path.startsWith("/api/captures")) {
      addWideEventFields(c, { routeName: "api.captures" });
    } else if (c.req.path.startsWith("/api/signals")) {
      addWideEventFields(c, { routeName: "api.signals" });
    } else if (c.req.path.startsWith("/api/syntheses")) {
      addWideEventFields(c, { routeName: "api.syntheses" });
    } else if (c.req.path.startsWith("/api/proposals")) {
      addWideEventFields(c, { routeName: "api.proposals" });
    } else if (c.req.path.startsWith("/api/reviews")) {
      addWideEventFields(c, { routeName: "api.reviews" });
    } else if (c.req.path.startsWith("/api/events")) {
      addWideEventFields(c, { routeName: "api.events" });
    }

    const db = sharedDb ? await sharedDb : await resolveDb(Db.layerD1(c.env.DB));
    const user = await resolveCurrentUser();
    const result = await apiHandler.handle(c.req.raw, {
      context: { db, user },
      prefix: "/api",
    });

    if (result.matched) {
      return c.newResponse(result.response.body, result.response);
    }

    await next();
  });

  app.onError((error, c) => {
    addWideEventFields(c, {
      status: 500,
      outcome: "error",
      errorType: error.name,
      errorMessage: error.message,
    });

    return c.json({ error: "Internal Server Error" }, 500);
  });

  app.get("/", (c) => {
    addWideEventFields(c, { routeName: "today" });

    return c.html(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
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

  app.get("/api/version", (c) => {
    addWideEventFields(c, { routeName: "api.version" });
    return c.json({
      service: "lares-web",
      version: c.env.APP_VERSION ?? "0.0.0",
    });
  });

  app.get("/__test/error", (c) => {
    if (c.env.ENVIRONMENT !== "test") {
      return c.notFound();
    }

    addWideEventFields(c, { routeName: "test.error" });
    throw new Error("test failure");
  });

  return app;
}
