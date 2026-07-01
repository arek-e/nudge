<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="apps/web/public/icons/vesta-logo-long-dark.svg">
  <img src="apps/web/public/icons/vesta-logo-long-light.svg" alt="Vesta" width="220">
</picture>

# Vesta

**A private workspace for notes, context, and reviewed agent actions**

Journal-first. Source-linked. Human-in-the-loop by default.

[Live App](https://vesta-web.teampitch.workers.dev/) &middot; [API Docs](https://vesta-web.teampitch.workers.dev/api/docs) &middot; [OpenAPI](https://vesta-web.teampitch.workers.dev/api/openapi.json)

</div>

---

## The Problem

Your life leaves context everywhere: messages, calendar commitments, relationship details, travel constraints, personal notes, work decisions, and small observations that only make sense later.

Most assistants either forget that context or hide it inside opaque prompts. Most productivity tools force you into a narrow workflow: a morning routine, a task inbox, a journal, a CRM, a daily planner.

**Vesta starts with writing things down.** Notes and captures become source-linked context that agents can read, interpret, and turn into draft actions for review.

Internally, Vesta keeps that loop small and inspectable: Captures become Signals, Signals form Context, Frames define what Vesta is helping with, Syntheses interpret that context, and Proposals, Reviews, Commitments, and Outcomes close the loop.

The goal is not another chatbot. The goal is a private operating layer that remembers what matters, shows its sources, asks before it acts, and improves through evals.

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

What is live now:

- Mobile-first captures, daily notes, and journal revisions.
- User-owned Signals, notes, summaries, memory, and traces in D1/R2.
- Source-linked Syntheses over a selected time frame.
- Draft extraction of actions, reminders, events, questions, ideas, and memory candidates from note revisions.
- Durable `UserAgentSession` conversations with memory retrieval and reviewable loop drafts.
- Memory indexing through the local memory index or Turbopuffer when configured.
- Proposal review flows that become Commitments and close with Outcomes.
- Better Auth sign-in in configured environments, including passkeys and optional Google.
- User data export and deletion.
- OpenAPI and MCP surfaces for custom integrations and agent tools.
- Safe wide events and trace spans for debugging and evals.

Model-backed extraction is narrow and draft-first. Vesta can suggest actions and memories, but behavior-changing automation stays reviewable before it becomes a commitment or external action.

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

`bun run dev` builds the web app, applies local D1 migrations, and starts the Vesta Worker with `wrangler dev` on the first available local port starting at `VESTA_DEV_PORT`.

Then open:

- App: `$VESTA_DEV_URL/`
- Health: `$VESTA_DEV_URL/health`
- API docs: `$VESTA_DEV_URL/api/docs`
- OpenAPI spec: `$VESTA_DEV_URL/api/openapi.json`

## Features

|                   | Feature                     | Description                                                  |
| ----------------- | --------------------------- | ------------------------------------------------------------ |
| :memo:            | **Captures**                | User or integration input recorded as source-linked Signals  |
| :signal_strength: | **Signals**                 | Append-only D1 records with occurrence time and payload      |
| :compass:         | **Frames**                  | Bounded questions like “What matters now?”                   |
| :sparkles:        | **Syntheses**               | Deterministic, source-linked interpretations over Signals    |
| :link:            | **OpenAPI integrations**    | Public API contract for user-owned data and custom workflows |
| :shield:          | **Human-in-the-loop model** | Review-first posture for memory, actions, and automation     |
| :bar_chart:       | **Persistent traces**       | Safe wide events stored in D1 for debugging and improvement  |
| :iphone:          | **Mobile-first app**        | PWA surface optimized for capture, notes, and review         |

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
|                    Vesta Worker                  |
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

- **`apps/web`**: unified Vesta app layer: Cloudflare Worker, Hono app, oRPC/OpenAPI API, Better Auth, Workers Workflow, Cloudflare Agent entrypoints, React PWA surface, and static assets.
- **`apps/ios`**: native SwiftUI app for iOS and Siri.
- **`apps/web/src/api-contract.ts`**: shared TypeScript contract for the app API.
- **`packages/db`**: D1 schema, migrations, and Effect `Db` service.
- **`packages/ui`**: shared React UI components and design tokens.
- **`packages/observability`**: shared tracing, Braintrust wrappers, trace-cache read models, request telemetry, and safe error fields.
- **`packages/effect-services`**: Effect service seams for auth, primitive workflows, and memory indexing.
- **`packages/evals`**: golden-case agent/product evals.

## Stack

- Cloudflare Workers, D1, R2, Durable Objects, Workers Workflows.
- Cloudflare Agents, Workers AI, and optional Turbopuffer memory search.
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
bun run dev            # build web and start the Worker with wrangler dev
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

Run `bun run check` and `bun run test:e2e` before deploying. The deploy script refuses dirty working trees, builds the web app, stamps `APP_VERSION` with the short Git SHA, and deploys the Worker with a matching Cloudflare version tag/message.

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
