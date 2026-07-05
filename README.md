<div align="center">

<img src="apps/web/public/icons/nudge-logo-lockup-blobby-n-transparent.svg" alt="Nudge" width="240">

# Nudge

## The private context layer for notes, memory, and reviewable AI.

[Website](https://explorenudge.com/) · [App](https://app.explorenudge.com/) · [Downloads](https://explorenudge.com/) · [Docs](docs/product-vision.md) · [API](https://nudge-web.teampitch.workers.dev/api/docs)

<br>

<img src="apps/marketing/public/images/nudge-hero-open-sky.png" alt="Nudge sticky notes turning into reviewed next steps" width="760">

</div>

## Why Nudge

Nudge is built for people who capture more context than they can process.

It brings notes, voice logs, app captures, and agent output into one reviewable
workspace. Agents can summarize, extract, remember, and propose, but they do not
silently change your commitments or memory. You stay in the loop.

Nudge is multi-surface: web and desktop should feel like the same React App Surface, SwiftUI iOS keeps native mobile capture and Siri/App Intents, and Raycast gives a fast command surface. Convex stores canonical product state in realtime, while the Cloudflare-hosted Nudge Engine runs the agent loop, integrations, API, review boundaries, and tool execution.

The web app is the first React surface for the same operating loop: capture, review, actions, summaries, settings, API docs, and local development. The desktop app should reuse that React surface logic rather than becoming a separate product fork.

### Cloud

The fastest way to start is the hosted app:

[Open Nudge](https://app.explorenudge.com/)

| Surface               | What it is                                                                    |
| --------------------- | ----------------------------------------------------------------------------- |
| **Web app / PWA**     | React App Surface for capture, notes, review, actions, summaries, settings    |
| **Desktop app**       | Desktop App Surface that should reuse web React surface logic and editors     |
| **Native iOS app**    | SwiftUI App Surface for mobile capture, notes, calendar context, Siri, review |
| **Raycast extension** | TypeScript command surface for fast capture, current context, ask, and review |
| **Siri App Intents**  | Voice capture phrases through the SwiftUI iOS app                             |
| **OpenAPI + MCP API** | Engine integration surface for custom tools and agent workflows               |

Download the latest desktop build from [explorenudge.com](https://explorenudge.com/).

```text
User / Surface / Integration
      |
      |  Capture
      v
+------------------+       +------------------+
| Convex product   | ----> | Nudge Engine     |
| notes, signals,  |       | agent loop, API, |
| reviews, memory  |       | tools, workflows |
+--------+---------+       +--------+---------+
         |                          |
         | realtime sync            | source-linked reasoning
         v                          v
+------------------+       +------------------+
| App Surfaces     |       | Synthesis,       |
| web, desktop,    | <---- | Proposal, Review |
| iOS, Raycast     |       | Commitment       |
+------------------+       +------------------+
```

See [desktop and Raycast release notes](docs/releasing-apps.md).

- Native iOS app source in `apps/ios/Nudge`, including Siri App Intents and local run instructions.
- Locked surface direction for desktop and Raycast extension.
- Siri capture through `POST /api/voice/log`.
- Mobile-first web captures, daily notes, and journal revisions.
- Canonical Convex product store for notes, Signals, summaries, memory, proposals, reviews, agent outputs, and outcomes.
- D1 remains available for trace persistence while product data moves through the Convex-backed store.
- Source-linked Syntheses over a selected time frame.
- Draft extraction of actions, reminders, events, questions, ideas, and memory candidates from note revisions.
- Durable `UserAgentSession` conversations with memory retrieval and reviewable loop drafts.
- Memory indexing through the local memory index or Turbopuffer when configured.
- Proposal review flows that become Commitments and close with Outcomes.
- Clerk sign-in for authenticated environments.
- User data export and deletion.
- OpenAPI and MCP surfaces for custom integrations and agent tools.
- Safe wide events and trace spans for debugging and evals.

The Raycast extension is not in the public Raycast Store yet. Install it locally:

```bash
bun install
bun run raycast:dev
```

Tagged GitHub Releases also upload `Nudge-Raycast-build-<tag>.zip` as an
internal compiled QA artifact. It is not a one-click installer. Publish with
`bun run raycast:publish` when the Store or private organization listing is ready.

### iOS

The Native iOS app includes SwiftUI capture, calendar context, review, and
Siri capture through App Intents.

Open `apps/ios/Nudge/Nudge.xcodeproj` in Xcode and run the `Nudge Local`,
`Nudge Staging`, or `Nudge Production` scheme.

TestFlight/App Store deployment is not wired yet.

### Local Development

```bash
bun install
bun run dev
```

Open the local app at `$NUDGE_DEV_URL`.

## Everything You Need

Nudge gives you one operating loop across every surface: capture context, sync it
to a workspace, ask an agent to reason over it, then review the result before it
becomes memory or action.

| Surface        | What it does                                                       |
| -------------- | ------------------------------------------------------------------ |
| Web app / PWA  | Notes, capture, review, actions, summaries, settings, and API docs |
| macOS desktop  | Native shell for the shared Nudge workspace                        |
| Native iOS app | SwiftUI capture, notes, calendar context, review, and Siri capture |
| Raycast        | Fast capture, current context, Ask Nudge, and lightweight review   |
| API + MCP      | Integration surface for tools and agent workflows                  |

- App: `$NUDGE_DEV_URL/`
- Health: `$NUDGE_DEV_URL/health`
- API docs: `$NUDGE_DEV_URL/api/docs`
- OpenAPI spec: `$NUDGE_DEV_URL/api/openapi.json`

To run the iOS app:

1. Keep `bun run dev` running from the repo root.
2. Open `apps/ios/Nudge/Nudge.xcodeproj` in Xcode.
3. Run the `Nudge Local` scheme on an iOS Simulator or device.
4. If needed, update the Engine URL from the iOS app settings screen.

See [`apps/ios/Nudge/README.md`](apps/ios/Nudge/README.md) for Siri phrases and device networking notes.

## Features

|                        | Feature                     | Description                                                   |
| ---------------------- | --------------------------- | ------------------------------------------------------------- |
| :globe_with_meridians: | **Web app / PWA**           | React surface for notes, review, settings, and API docs       |
| :desktop_computer:     | **Desktop app**             | Desktop shell sharing web React surface logic                 |
| :iphone:               | **Native iOS app**          | SwiftUI app for capture, notes, calendar context, and Siri    |
| :mag:                  | **Raycast extension**       | Command surface for capture, current context, ask, and review |
| :microphone:           | **Siri capture**            | App Intents for hands-free note logging into Nudge            |
| :memo:                 | **Captures**                | User or integration input recorded as source-linked Signals   |
| :signal_strength:      | **Signals**                 | Source-linked Convex records with occurrence time and payload |
| :compass:              | **Frames**                  | Bounded questions like “What matters now?”                    |
| :sparkles:             | **Syntheses**               | Deterministic, source-linked interpretations over Signals     |
| :link:                 | **OpenAPI integrations**    | Public API contract for user-owned data and custom workflows  |
| :shield:               | **Human-in-the-loop model** | Review-first posture for memory, actions, and automation      |
| :bar_chart:            | **Persistent traces**       | Safe wide events stored in D1 for debugging and improvement   |

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
+----------------------+   +----------------------+   +----------------------+
| Web React surface    |   | Desktop app          |   | SwiftUI iOS / Siri   |
+----------+-----------+   +----------+-----------+   +----------+-----------+
           |                          |                          |
           +------------+-------------+-------------+------------+
                        |                           |
                        v                           v
              +------------------+        +----------------------+
              | Convex product   | <----> | Nudge Engine         |
              | store + realtime |        | Worker/Agents/Flows  |
              +--------+---------+        +----------+-----------+
                       |                             |
                       v                             v
              +------------------+        +----------------------+
              | Raycast surface  |        | R2 artifacts / D1    |
              | commands/status  |        | trace cache          |
              +------------------+        +----------------------+
```

- **`apps/ios`**: SwiftUI iOS App Surface, Siri App Intents, capture UI, calendar views, and local device docs.
- **`apps/web`**: Cloudflare Worker, Hono app, oRPC/OpenAPI API, Clerk auth, Workers Workflow, Cloudflare Agent entrypoints, React PWA surface, and static assets.
- **`apps/desktop`**: desktop App Surface that reuses web React surface logic and editor modules.
- **`apps/raycast`**: Raycast TypeScript App Surface for fast capture, current context, ask, and lightweight review.
- **`apps/web/src/api-contract.ts`**: shared TypeScript contract for the app API.
- **`packages/db`**: product storage port plus legacy/local D1 adapters.
- **`packages/db-convex`**: Convex-backed product storage adapter and runtime Convex client wiring.
- **`packages/surface`**: shared App Surface logic for local draft policy, Convex note payloads, signal previews, and local date helpers.
- **`packages/ui`**: shared React UI components, design tokens, and surface primitives for web and desktop.
- **`packages/observability`**: shared tracing, Braintrust wrappers, trace-cache read models, request telemetry, and safe error fields.
- **`packages/effect-services`**: reusable Nudge Engine workflows, Effect services, memory indexing, and OKF projection.
- **`packages/evals`**: golden-case agent/product evals.

## Stack

- Convex for canonical realtime product data across App Surfaces and runtime code.
- Cloudflare Workers, D1 trace cache, R2, Durable Objects, Workers Workflows.
- Cloudflare Agents, Workers AI, and optional Turbopuffer memory search.
- Desktop shell, SwiftUI for iOS, and Raycast API for command surfaces.
- Hono for Worker routing and middleware.
- oRPC/OpenAPI for public API contracts and typed frontend clients.
- React, TanStack Router, TanStack Query, TanStack Table, Motion.
- Clerk for user authentication across the web app and Convex sync.
- Effect v4 for services and dependency injection.
- Drizzle over D1 for legacy/local adapters and trace persistence.
- Bun, Mise, Oxfmt, Oxlint, Lefthook.

## Development

```bash
bun run check          # format + lint + typecheck + unit tests
bun run test:e2e       # desktop-mounted web Playwright e2e
bun run dev            # build web and start the Worker with wrangler dev
```

Agent evals run locally by default and are part of `bun run check`:

```bash
bun run eval:agent
```

To publish the same local eval report to Braintrust as an experiment, opt in
explicitly:

```bash
BRAINTRUST_EVALS=true \
BRAINTRUST_API_KEY=<from OpenBao teampitch/nudge/braintrust> \
BRAINTRUST_ORG_NAME=Teampitch \
BRAINTRUST_PROJECT_ID=2ce231a6-edbc-4e8d-8bfe-a54e70bdb738 \
bun run eval:agent
```

GitHub Actions deploys the Cloudflare Worker from the production workflow.
Release builds for macOS and Raycast are documented in
[docs/releasing-apps.md](docs/releasing-apps.md).

## Brand Assets

| Asset           | Path                                                                                                             |
| --------------- | ---------------------------------------------------------------------------------------------------------------- |
| Logo lockup     | [`nudge-logo-lockup-blobby-n-transparent.svg`](apps/web/public/icons/nudge-logo-lockup-blobby-n-transparent.svg) |
| Logo lockup PNG | [`nudge-logo-lockup-blobby-n-transparent.png`](apps/web/public/icons/nudge-logo-lockup-blobby-n-transparent.png) |
| App icon        | [`nudge-app-icon.svg`](apps/web/public/icons/nudge-app-icon.svg)                                                 |
| App icon PNG    | [`nudge-app-icon.png`](apps/web/public/icons/nudge-app-icon.png)                                                 |

| Area                            | Status                                                                                                                                                                           |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Repository CI**               | `CI` runs Bun install, format, lint, typecheck, unit tests, web build, and Playwright E2E on `main`.                                                                             |
| **Cloudflare Worker / web app** | GitHub Actions deploys the Cloudflare Worker, web assets, and remote D1 migrations after successful `main` CI.                                                                   |
| **Native iOS app**              | The Xcode project is checked in and manually runnable from `apps/ios/Nudge` with Local, Staging, and Production schemes. Siri branding and phrase docs are covered by Bun tests. |
| **Desktop app**                 | `apps/desktop` mounts the shared React web surface and has Electron e2e coverage; release automation is not wired yet.                                                           |
| **Raycast extension**           | `apps/raycast` has capture, current context, ask, and review commands with service e2e coverage; release flow is not wired yet.                                                  |
| **iOS release automation**      | TestFlight/App Store deployment is not wired yet. There is no macOS GitHub Actions job, `xcodebuild archive`, Fastlane lane, or signing flow.                                    |

[Product vision](docs/product-vision.md) · [Domain glossary](CONTEXT.md) · [Architecture decisions](docs/adr/) · [Releases](https://github.com/arek-e/nudge/releases)

## License

Private project for now.
