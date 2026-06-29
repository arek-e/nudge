<div align="center">

# Lares

**A private operating layer for personal context and agentic work**

Cloudflare-native. OpenAPI-first. Human-in-the-loop by default.

[Live App](https://lares-web.teampitch.workers.dev/) &middot; [API Docs](https://lares-web.teampitch.workers.dev/api/docs) &middot; [OpenAPI](https://lares-web.teampitch.workers.dev/api/openapi.json)

</div>

---

## The Problem

Your life leaves context everywhere: messages, calendar commitments, relationship details, travel constraints, personal notes, work decisions, and small observations that only make sense later.

Most assistants either forget that context or hide it inside opaque prompts. Most productivity tools hardcode a niche workflow: a morning routine, a task inbox, a journal, a CRM, a daily planner.

**Lares takes a primitive-first approach.** Captures become Signals. Signals form Context. Frames bound what Lares is helping with. Syntheses interpret the context. Later, Proposals, Reviews, Commitments, and Outcomes close the loop.

The goal is not a chatbot. The goal is a private operating layer that remembers what matters, shows its sources, asks for review before sensitive changes, and improves through evals.

## How It Works

```text
User / Integration
      |
      |  Capture
      v
+----------------+       +----------------+
|    Signals     | ----> |    Context     |
| append-only D1 |       | time-scoped    |
+----------------+       +-------+--------+
                                  |
                                  | Frame: "What matters now?"
                                  v
                         +----------------+
                         |   Synthesis    |
                         | source-linked  |
                         +-------+--------+
                                  |
                                  | later
                                  v
                         +----------------+
                         | Proposal/Review|
                         | HITL decisions |
                         +----------------+
```

Current deployed slice:

- Capture context from the mobile-first app.
- Persist user-owned Signals in D1.
- Query Signals by time range.
- Generate a deterministic, source-linked Synthesis for the current Frame.
- Save daily notes and journal documents with revisions.
- Extract reviewable actions, reminders, events, questions, ideas, and memory candidates from note revisions.
- Run a durable `UserAgentSession` for conversations, memory retrieval, and reviewable loop drafts.
- Index memory documents through the local memory index or Turbopuffer when configured.
- Review Proposals into Commitments and close them with Outcomes.
- List generated Summaries.
- Sign in through Better Auth in configured environments, including passkeys and optional Google.
- Export or delete user-owned data.
- Read OpenAPI docs for custom integrations.
- Persist safe wide events and trace spans for debugging and evals.

Model-backed extraction is narrow and draft-first. External writes and behavior-changing automation still require explicit review before they are added.

## Quick Start

```bash
mise install
bun install
bun run db:migrations:apply:local
bun run dev
```

Then open:

- App: `http://localhost:8787/`
- Health: `http://localhost:8787/health`
- API docs: `http://localhost:8787/api/docs`
- OpenAPI spec: `http://localhost:8787/api/openapi.json`

## Features

|                   | Feature                     | Description                                                    |
| ----------------- | --------------------------- | -------------------------------------------------------------- |
| :memo:            | **Captures**                | User or integration input recorded as source-linked Signals    |
| :signal_strength: | **Signals**                 | Append-only D1 records with occurrence time and payload        |
| :compass:         | **Frames**                  | Bounded questions like “What matters now?”                     |
| :sparkles:        | **Syntheses**               | Deterministic, source-linked interpretations over Signals      |
| :link:            | **OpenAPI integrations**    | Public API contract for user-owned data and custom workflows   |
| :shield:          | **Human-in-the-loop model** | Review-first posture for future memory/actions/automation      |
| :bar_chart:       | **Persistent traces**       | Safe wide events stored in D1 for debugging and improvement    |
| :iphone:          | **Mobile-first app**        | React dashboard with TanStack Router, Query, Table, and Motion |

## Architecture

```text
+--------------------------------------------------+
|                  Cloudflare Worker               |
|  Hono API  -  oRPC/OpenAPI  -  React static app   |
+---------------------+----------------------------+
                      |
      +---------------+---------------+
      |                               |
      v                               v
+------------+                 +-------------+
| D1         |                 | R2          |
| Signals    |                 | Redacted    |
| Frames     |                 | artifacts   |
| Syntheses  |                 +-------------+
| Notes      |
| Memory     |
| Traces     |
+------------+
      |
      v
+--------------------+       +----------------------+
| Durable Objects    |       | Workers Workflows    |
| user agents        |       | note/digest analysis |
+--------------------+       +----------------------+
```

- **`apps/web`**: Cloudflare Worker, Hono app, React app, oRPC/OpenAPI API, Better Auth, Workers Workflow, and Cloudflare Agent entrypoints.
- **`packages/db`**: D1 schema, migrations, and Effect `Db` service.
- **`packages/ui`**: shared React UI components and design tokens.
- **`packages/observability`**: wide-event logging, request telemetry, and safe error fields.
- **`packages/effect-services`**: Effect service seams for auth, primitive workflows, and memory indexing.
- **`packages/evals`**: golden-case agent/product evals.

## Stack

- Cloudflare Workers, D1, R2, Durable Objects, Workers Workflows.
- Cloudflare Agents, Think, Workers AI, and optional Turbopuffer memory search.
- Hono for Worker routing and middleware.
- oRPC/OpenAPI for public API contracts and typed frontend clients.
- React, TanStack Router, TanStack Query, TanStack Table, Motion.
- Better Auth for email, passkey, and optional Google authentication.
- Effect v4 for services and dependency injection.
- Drizzle over D1 behind an Effect `Db` port.
- Bun, Mise, Oxfmt, Oxlint, Lefthook.

## Development

```bash
bun run check          # format + lint + typecheck + unit tests
bun run test:e2e       # mobile Playwright smoke test
bun run dev            # build client and start wrangler dev
```

Useful operational commands:

```bash
bun run logs:tail
bun run logs:tail:pretty
bun run traces:recent
```

## Deployment

Deploys are tied to Git commits.

```bash
bun run deploy
```

The deploy script refuses dirty working trees, runs checks and mobile e2e, builds the app, stamps `APP_VERSION` with the short Git SHA, and deploys with a matching Cloudflare Worker version tag/message.

For explicit prototype deploys only:

```bash
bun run deploy:dirty
```

See [`docs/deployment.md`](docs/deployment.md) for rollback and PR guidance.

## Documentation

- [`CONTEXT.md`](CONTEXT.md): glossary and primitive domain language.
- [`docs/product-vision.md`](docs/product-vision.md): product direction.
- [`docs/prd/daily-operating-loop-mvp.md`](docs/prd/daily-operating-loop-mvp.md): historical MVP PRD.
- [`docs/adr/`](docs/adr/): durable architecture decisions.
- [`docs/observability-and-evals.md`](docs/observability-and-evals.md): trace/eval direction.
- [`docs/resilience.md`](docs/resilience.md): retry and replay guarantees.

## License

Private project for now.

---

<div align="center">
<pre>
Lares — private context, source-linked memory,
and agents that ask before they act.
</pre>
</div>
