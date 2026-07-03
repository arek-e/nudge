<div align="center">

<img src="apps/web/public/icons/nudge-logo-lockup-blobby-n-transparent.svg" alt="Nudge" width="220">

# Nudge

**A native iOS journal and Siri capture app for private context**

iOS-first. Journal-led. Source-linked. Human-in-the-loop.

[Marketing Site](https://explorenudge.com/) &middot; [Live Web App](https://app.explorenudge.com/) &middot; [iOS App](apps/ios/Nudge) &middot; [API Docs](https://app.explorenudge.com/api/docs) &middot; [OpenAPI](https://app.explorenudge.com/api/openapi.json)

</div>

---

## What Nudge Is

Nudge is an iOS-first private workspace for writing things down, capturing notes with Siri, and letting agents turn that context into reviewable drafts.

The native iOS app is the primary surface: quick captures, daily notes, calendar-aware context, and Siri phrases such as "Tell Nudge" or "Log this in Nudge." The Cloudflare backend stores the source material, runs analysis, and exposes OpenAPI/MCP surfaces for integrations and agents.

The web app is the companion surface for the same operating loop: capture, review, actions, summaries, settings, API docs, and local development.

Internally, Nudge keeps the model small and inspectable: Captures become Signals, Signals form Context, Frames define what Nudge is helping with, Syntheses interpret that context, and Proposals, Reviews, Commitments, and Outcomes close the loop.

The goal is not another chatbot. The goal is a private operating layer that remembers what matters, shows its sources, asks before it acts, and improves through evals.

## App Surfaces

| Surface               | What it is                                                                  |
| --------------------- | --------------------------------------------------------------------------- |
| **Native iOS app**    | SwiftUI app for journal capture, calendar context, Siri capture, and review |
| **Siri App Intents**  | Voice capture phrases that post directly to the Nudge API                   |
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
| append-only    |       | time-scoped    |
| Convex records |       |                |
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

- Native iOS app source in `apps/ios/Nudge`, including Siri App Intents and local run instructions.
- Siri capture through `POST /api/voice/log`.
- Mobile-first web captures, daily notes, and journal revisions.
- User-owned Signals, notes, summaries, and memory in Convex.
- Source-linked Syntheses over a selected time frame.
- Draft extraction of actions, reminders, events, questions, ideas, and memory candidates from note revisions.
- Durable `UserAgentSession` conversations with memory retrieval and reviewable loop drafts.
- Memory indexing through the local memory index or Turbopuffer when configured.
- Proposal review flows that become Commitments and close with Outcomes.
- Clerk sign-in for authenticated environments.
- User data export and deletion.
- OpenAPI and MCP surfaces for custom integrations and agent tools.
- Safe wide events and trace spans for debugging and evals.

Model-backed extraction is narrow and draft-first. Nudge can suggest actions and memories, but behavior-changing automation stays reviewable before it becomes a commitment or external action.

## Quick Start

One-time machine setup:

```bash
brew install direnv
grep -q 'direnv hook zsh' ~/.zshrc || echo 'eval "$(direnv hook zsh)"' >> ~/.zshrc
mkdir -p ~/.config/direnv
cat > ~/.config/direnv/direnv.toml <<'EOF'
[whitelist]
prefix = [
  "/path/to/your/nudge/worktree-parent",
]
EOF
exec zsh
```

Also install [`mise`](https://mise.jdx.dev/) and authenticate Cloudflare/Wrangler
for commands that use remote Cloudflare resources. The direnv whitelist lets every
Nudge worktree under the configured parent load its `.envrc` without a separate
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
default each worktree gets a deterministic high-band `NUDGE_DEV_PORT`,
`NUDGE_DEV_URL`, Wrangler inspector port, and local Wrangler state path so
multiple dev stacks can run side by side. Use `.envrc.local` for untracked local
overrides.

`bun run dev` builds the web app and starts the Nudge Worker with `wrangler dev` on the first available local port starting at `NUDGE_DEV_PORT`.

Then open:

- App: `$NUDGE_DEV_URL/`
- Health: `$NUDGE_DEV_URL/health`
- API docs: `$NUDGE_DEV_URL/api/docs`
- OpenAPI spec: `$NUDGE_DEV_URL/api/openapi.json`

To run the iOS app:

1. Keep `bun run dev` running from the repo root.
2. Open `apps/ios/Nudge/Nudge.xcodeproj` in Xcode.
3. Run the `Nudge` scheme on an iOS Simulator or device.
4. If needed, update the Engine URL from the iOS app settings screen.

See [`apps/ios/Nudge/README.md`](apps/ios/Nudge/README.md) for Siri phrases and device networking notes.

## Features

|                   | Feature                     | Description                                                  |
| ----------------- | --------------------------- | ------------------------------------------------------------ |
| :iphone:          | **Native iOS app**          | SwiftUI app for capture, notes, calendar context, and Siri   |
| :microphone:      | **Siri capture**            | App Intents for hands-free note logging into Nudge           |
| :memo:            | **Captures**                | User or integration input recorded as source-linked Signals  |
| :signal_strength: | **Signals**                 | Append-only Convex records with occurrence time and payload  |
| :compass:         | **Frames**                  | Bounded questions like “What matters now?”                   |
| :sparkles:        | **Syntheses**               | Deterministic, source-linked interpretations over Signals    |
| :link:            | **OpenAPI integrations**    | Public API contract for user-owned data and custom workflows |
| :shield:          | **Human-in-the-loop model** | Review-first posture for memory, actions, and automation     |
| :bar_chart:       | **Wide logs**               | Safe request events emitted for debugging and improvement    |

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
|                    Nudge Worker                  |
|       Cloudflare Worker - Hono - oRPC/OpenAPI     |
+---------------------+----------------------------+
                      |
      +---------------+---------------+
      |                               |
      v                               v
+------------+                 +-------------+
| Convex     |                 | R2          |
| Signals    |                 | Media/OKF   |
| Frames     |                 | files       |
| Syntheses  |                 +-------------+
| Notes      |
| Memory     |
| Reviews    |
+------------+
      |
      v
+--------------------+       +----------------------+
| Durable Objects    |       | Workers Workflows    |
| user agents        |       | note/digest analysis |
+--------------------+       +----------------------+
```

- **`apps/ios`**: native SwiftUI app, Siri App Intents, capture UI, calendar views, and local device docs.
- **`apps/web`**: Cloudflare Worker, Hono app, oRPC/OpenAPI API, Clerk auth, Workers Workflow, Cloudflare Agent entrypoints, React PWA surface, and static assets.
- **`apps/web/src/api-contract.ts`**: shared TypeScript contract for the app API.
- **`packages/db`**: Effect `Db` service and legacy local adapters.
- **`packages/db-convex`**: Convex-backed runtime adapter for the `Db` service.
- **`packages/ui`**: shared React UI components and design tokens.
- **`packages/observability`**: shared trace context helpers, Braintrust wrappers, request telemetry, and safe error fields.
- **`packages/effect-services`**: Effect service seams for auth, primitive workflows, and memory indexing.
- **`packages/evals`**: golden-case agent/product evals.

## Stack

- Cloudflare Workers, R2, Durable Objects, Workers Workflows.
- Convex for canonical product persistence and realtime sync.
- Cloudflare Agents, Workers AI, and optional Turbopuffer memory search.
- Hono for Worker routing and middleware.
- oRPC/OpenAPI for public API contracts and typed frontend clients.
- React, TanStack Router, TanStack Query, TanStack Table, Motion.
- Clerk for user authentication across the web app and Convex sync.
- Effect v4 for services and dependency injection.
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
```

## CI And Release Status

| Area                            | Status                                                                                                                                                                           |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Repository CI**               | `CI` runs Bun install, format, lint, typecheck, unit tests, web build, and WebKit E2E on `main`.                                                                                 |
| **Cloudflare Worker / web app** | GitHub Actions deploys the Cloudflare Worker and web assets after successful `main` CI.                                                                                          |
| **Native iOS app**              | The Xcode project is checked in and manually runnable from `apps/ios/Nudge` with Local, Staging, and Production schemes. Siri branding and phrase docs are covered by Bun tests. |
| **iOS release automation**      | TestFlight/App Store deployment is not wired yet. There is no macOS GitHub Actions job, `xcodebuild archive`, Fastlane lane, or signing flow.                                    |

## Deployment

Web/backend deploys are tied to Git commits.

```bash
bun run deploy
```

Run `bun run check` and `bun run test:e2e` before deploying. The deploy script refuses dirty working trees, builds the web app, stamps `APP_VERSION` with the short Git SHA, and deploys the Worker with a matching Cloudflare version tag/message.

The current CI does not deploy the iOS app. To ship iOS from the repo, add a macOS release workflow that runs `xcodebuild archive`, signs with App Store Connect credentials, and uploads to TestFlight or App Store Connect.

For physical-device QA, use the `Vesta Staging` Xcode scheme. It installs as `app.vesta.ios.staging` and points at `https://vesta-web-staging.teampitch.workers.dev`. Use `Vesta Production` only when validating the production backend at `https://vesta-web.teampitch.workers.dev`.

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
Nudge — private context, source-linked memory,
and agents that ask before they act.
</pre>
</div>
