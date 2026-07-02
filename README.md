<div align="center">

<img src="apps/web/public/icons/nudge-logo-lockup-blobby-n-transparent.svg" alt="Nudge" width="220">

# Nudge

**A native iOS journal and Siri capture app for private context**

iOS-first. Journal-led. Source-linked. Human-in-the-loop.

[Live Web App](https://vesta-web.teampitch.workers.dev/) &middot; [iOS App](apps/ios/Vesta) &middot; [API Docs](https://vesta-web.teampitch.workers.dev/api/docs) &middot; [OpenAPI](https://vesta-web.teampitch.workers.dev/api/openapi.json)

</div>

---

## What Vesta Is

Vesta is an iOS-first private workspace for writing things down, capturing notes with Siri, and letting agents turn that context into reviewable drafts.

The native iOS app is the primary surface: quick captures, daily notes, calendar-aware context, and Siri phrases such as "Tell Vesta" or "Log this in Vesta." The Cloudflare backend stores the source material, runs analysis, and exposes OpenAPI/MCP surfaces for integrations and agents.

The web app is the companion surface for the same operating loop: capture, review, actions, summaries, settings, API docs, and local development.

Internally, Vesta keeps the model small and inspectable: Captures become Signals, Signals form Context, Frames define what Vesta is helping with, Syntheses interpret that context, and Proposals, Reviews, Commitments, and Outcomes close the loop.

The goal is not another chatbot. The goal is a private operating layer that remembers what matters, shows its sources, asks before it acts, and improves through evals.

## App Surfaces

| Surface               | What it is                                                                  |
| --------------------- | --------------------------------------------------------------------------- |
| **Native iOS app**    | SwiftUI app for journal capture, calendar context, Siri capture, and review |
| **Siri App Intents**  | Voice capture phrases that post directly to the Vesta API                   |
| **Web app / PWA**     | Companion surface for capture, review, actions, summaries, and settings     |
| **OpenAPI + MCP API** | Integration surface for custom tools and agent workflows                    |

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

- Native iOS app source in `apps/ios/Vesta`, including Siri App Intents and local run instructions.
- Siri capture through `POST /api/voice/log`.
- Mobile-first web captures, daily notes, and journal revisions.
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

To run the iOS app:

1. Keep `bun run dev` running from the repo root.
2. Open `apps/ios/Vesta/Vesta.xcodeproj` in Xcode.
3. Run the `Vesta` scheme on an iOS Simulator or device.
4. If needed, update the Engine URL from the iOS app settings screen.

See [`apps/ios/Vesta/README.md`](apps/ios/Vesta/README.md) for Siri phrases and device networking notes.

## Features

|                   | Feature                     | Description                                                  |
| ----------------- | --------------------------- | ------------------------------------------------------------ |
| :iphone:          | **Native iOS app**          | SwiftUI app for capture, notes, calendar context, and Siri   |
| :microphone:      | **Siri capture**            | App Intents for hands-free note logging into Vesta           |
| :memo:            | **Captures**                | User or integration input recorded as source-linked Signals  |
| :signal_strength: | **Signals**                 | Append-only D1 records with occurrence time and payload      |
| :compass:         | **Frames**                  | Bounded questions like “What matters now?”                   |
| :sparkles:        | **Syntheses**               | Deterministic, source-linked interpretations over Signals    |
| :link:            | **OpenAPI integrations**    | Public API contract for user-owned data and custom workflows |
| :shield:          | **Human-in-the-loop model** | Review-first posture for memory, actions, and automation     |
| :bar_chart:       | **Persistent traces**       | Safe wide events stored in D1 for debugging and improvement  |

## Brand Assets

Use the SVG assets directly when possible. The canonical PWA filenames stay
stable for browser install surfaces, while the `nudge-*` files are the explicit
brand assets for app UI and documentation.

| Asset                | Path                                                                                                             |
| -------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Logo lockup          | [`nudge-logo-lockup-blobby-n-transparent.svg`](apps/web/public/icons/nudge-logo-lockup-blobby-n-transparent.svg) |
| Logo lockup PNG      | [`nudge-logo-lockup-blobby-n-transparent.png`](apps/web/public/icons/nudge-logo-lockup-blobby-n-transparent.png) |
| App icon SVG         | [`nudge-app-icon.svg`](apps/web/public/icons/nudge-app-icon.svg)                                                 |
| App icon PNG         | [`nudge-app-icon.png`](apps/web/public/icons/nudge-app-icon.png)                                                 |
| Transparent app icon | [`nudge-app-icon-transparent.svg`](apps/web/public/icons/nudge-app-icon-transparent.svg)                         |

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

- **`apps/ios`**: native SwiftUI app, Siri App Intents, capture UI, calendar views, and local device docs.
- **`apps/web`**: Cloudflare Worker, Hono app, oRPC/OpenAPI API, Better Auth, Workers Workflow, Cloudflare Agent entrypoints, React PWA surface, and static assets.
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

## CI And Release Status

| Area                            | Status                                                                                                                                        |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Repository CI**               | `CI` runs Bun install, format, lint, typecheck, unit tests, web build, and WebKit E2E on `main`.                                              |
| **Cloudflare Worker / web app** | GitHub Actions deploys the Cloudflare Worker, web assets, and remote D1 migrations after successful `main` CI.                                |
| **Native iOS app**              | The Xcode project is checked in and manually runnable from `apps/ios/Vesta`. Siri branding and phrase docs are covered by Bun tests.          |
| **iOS release automation**      | TestFlight/App Store deployment is not wired yet. There is no macOS GitHub Actions job, `xcodebuild archive`, Fastlane lane, or signing flow. |

## Deployment

Web/backend deploys are tied to Git commits.

```bash
bun run deploy
```

Run `bun run check` and `bun run test:e2e` before deploying. The deploy script refuses dirty working trees, builds the web app, stamps `APP_VERSION` with the short Git SHA, and deploys the Worker with a matching Cloudflare version tag/message.

The current CI does not deploy the iOS app. To ship iOS from the repo, add a macOS release workflow that runs `xcodebuild archive`, signs with App Store Connect credentials, and uploads to TestFlight or App Store Connect.

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
