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

[Learn more about the product direction](docs/product-vision.md).

## Installation

### Cloud

The fastest way to start is the hosted app:

[Open Nudge](https://app.explorenudge.com/)

### macOS

Download the latest desktop build from [explorenudge.com](https://explorenudge.com/).

- Use `Nudge-<version>-universal.dmg` for normal installation.
- Use `Nudge-<version>-universal.zip` when you need the raw app bundle.
- Release assets are produced by `.github/workflows/release-apps.yml`.

See [desktop and Raycast release notes](docs/releasing-apps.md).

### Raycast

The Raycast extension is not in the public Raycast Store yet. Install it locally:

```bash
bun install
bun run raycast:dev
```

Tagged GitHub Releases also upload `Nudge-Raycast-extension-<tag>.zip`.
Publish with `bun run raycast:publish` when the Store listing is ready.

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

| Building block | Purpose                                           |
| -------------- | ------------------------------------------------- |
| Signals        | Source-linked records from notes, apps, and voice |
| Context        | The current working set Nudge can summarize       |
| Syntheses      | Grounded interpretations over recent signals      |
| Proposals      | Draft actions and memories waiting for review     |
| Commitments    | Accepted work with follow-through state           |
| Outcomes       | Closed-loop review of what happened               |

## Stack

- TypeScript, Bun, Oxfmt, Oxlint
- React, TanStack Router, TanStack Query, Motion
- Cloudflare Workers, D1, R2, Durable Objects, Workers Workflows
- Convex for realtime product state
- Hono and oRPC/OpenAPI for the public API
- Clerk for authentication
- Effect for services and workflows
- Electron, SwiftUI, and Raycast for app surfaces

## Development

```bash
bun run check
bun run --cwd apps/web test:e2e
bun run desktop:dist:mac
bun run raycast:dev
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

## Links

[Product vision](docs/product-vision.md) · [Domain glossary](CONTEXT.md) · [Architecture decisions](docs/adr/) · [Releases](https://github.com/arek-e/nudge/releases)

## License

Private project for now.
