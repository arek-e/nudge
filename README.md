<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="apps/web/public/icons/vesta-logo-long-dark.svg">
  <img src="apps/web/public/icons/vesta-logo-long-light.svg" alt="Vesta" width="220">
</picture>

# Vesta

**A private operating layer for personal context and agentic work**

Cloudflare-native. OpenAPI-first. Human-in-the-loop by default.

[Live App](https://vesta-web.teampitch.workers.dev/) &middot; [API Docs](https://vesta-web.teampitch.workers.dev/api/docs) &middot; [OpenAPI](https://vesta-web.teampitch.workers.dev/api/openapi.json)

</div>

---

## The Problem

Your life leaves context everywhere: messages, calendar commitments, relationship details, travel constraints, personal notes, work decisions, and small observations that only make sense later.

Most assistants either forget that context or hide it inside opaque prompts. Most productivity tools hardcode a niche workflow: a morning routine, a task inbox, a journal, a CRM, a daily planner.

**Vesta takes a primitive-first approach.** Captures become Signals. Signals form Context. Frames bound what Vesta is helping with. Syntheses interpret the context. Later, Proposals, Reviews, Commitments, and Outcomes close the loop.

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
- Use MCP tools to read/search workspace context, append simple captures, and create reviewable proposals.
- Persist safe wide events and trace spans for debugging and evals.

Model-backed extraction is narrow and draft-first. External writes and behavior-changing automation still require explicit review before they are added.

## Quick Start

One-time machine setup:

```bash
brew install direnv
grep -q 'direnv hook zsh' ~/.zshrc || echo 'eval "$(direnv hook zsh)"' >> ~/.zshrc
mkdir -p ~/.config/direnv
cat > ~/.config/direnv/direnv.toml <<'EOF'
[whitelist]
prefix = [
  "/path/to/your/vesta/worktree-parent",
]
EOF
exec zsh
```

Also install [`mise`](https://mise.jdx.dev/) and authenticate Cloudflare/Wrangler
for commands that use remote Cloudflare resources. The direnv whitelist lets every
Vesta worktree under the configured parent load its `.envrc` without a separate
`direnv allow`.

Per-worktree setup:

```bash
mise trust
mise install
mise exec -- bun install
mise exec -- bun run dev
```

If your shell already activates `mise`, the `mise exec --` prefix is optional.

The checked-in `.envrc` loads a stable per-worktree development environment. By
default each worktree gets a deterministic high-band `VESTA_DEV_PORT`,
`VESTA_DEV_URL`, Wrangler inspector port, and local Wrangler state path so
multiple dev stacks can run side by side. Use `.envrc.local` for untracked local
overrides.

`bun run dev` builds the web App Surface, applies local D1 migrations, and starts the Vesta Engine with `wrangler dev` on the first available local port starting at `VESTA_DEV_PORT`.

Then open:

- App: `$VESTA_DEV_URL/`
- Health: `$VESTA_DEV_URL/health`
- API docs: `$VESTA_DEV_URL/api/docs`
- OpenAPI spec: `$VESTA_DEV_URL/api/openapi.json`

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

## Brand Assets

Use the SVG assets directly when possible. The light variants are tuned for
white or warm surfaces; the dark variants are tuned for the current dark Vesta
app shell.

| Asset         | Light                                                                          | Dark                                                                         |
| ------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| Short mark    | [`vesta-logo-light.svg`](apps/web/public/icons/vesta-logo-light.svg)           | [`vesta-logo-dark.svg`](apps/web/public/icons/vesta-logo-dark.svg)           |
| Long lockup   | [`vesta-logo-long-light.svg`](apps/web/public/icons/vesta-logo-long-light.svg) | [`vesta-logo-long-dark.svg`](apps/web/public/icons/vesta-logo-long-dark.svg) |
| App icon      | [`vesta-app-icon-light.svg`](apps/web/public/icons/vesta-app-icon-light.svg)   | [`vesta-app-icon.svg`](apps/web/public/icons/vesta-app-icon.svg)             |
| Animated mark | [`vesta-logo-animated.svg`](apps/web/public/icons/vesta-logo-animated.svg)     | [`vesta-logo-animated.svg`](apps/web/public/icons/vesta-logo-animated.svg)   |

## Architecture

```text
+--------------------------------------------------+
|                    Vesta Engine                  |
|       Cloudflare Worker - Hono - oRPC/OpenAPI     |
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

- **`apps/web`**: unified Vesta app layer, Cloudflare Worker, Hono app, oRPC/OpenAPI API, Better Auth, Workers Workflow, Cloudflare Agent entrypoints, and PWA surface.
- **`apps/web`**: React App Surface served by the Engine.
- **`apps/ios`**: Native SwiftUI App Surface for iOS and Siri.
- **`apps/web/src/api-contract.ts`**: shared TypeScript contract for the app API.
- **`packages/db`**: D1 schema, migrations, and Effect `Db` service.
- **`packages/ui`**: shared React UI components and design tokens.
- **`packages/observability`**: shared tracing, Braintrust wrappers, trace-cache read models, request telemetry, and safe error fields.
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
bun run dev            # build web and start the Engine with wrangler dev
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

Run `bun run check` and `bun run test:e2e` before deploying. The deploy script refuses dirty working trees, builds the web App Surface, stamps `APP_VERSION` with the short Git SHA, and deploys the Engine with a matching Cloudflare Worker version tag/message.

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
Vesta — private context, source-linked memory,
and agents that ask before they act.
</pre>
</div>
