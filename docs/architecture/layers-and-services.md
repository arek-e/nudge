# Layers and Services

Nudge copies the production discipline from `pingdotgg/t3code`, not its runtime shape. The
top-level Worker runtime is intentionally split into a service interface and live layer; smaller
modules still earn that split case by case.

## What We Keep

- `apps/web/src/app.ts` owns Hono app composition, middleware installation, runtime caching, and request context construction.
- `apps/web/src/routes/` owns HTTP route registration by surface: static/PWA routes and authenticated API middleware.
- `apps/web/src/api-router.ts` owns oRPC/OpenAPI contract wiring and is the only API implementation adapter that runs Effect programs. `apps/web/src/api/actions/` owns named Effect-native handler implementations, and `apps/web/src/api/db/` owns the Effect-returning DB read/write groups those actions need.
- `apps/web/src/Services/NudgeApp.ts` owns the `NudgeApp` service interface: Cloudflare bindings, model config, auth session resolution, OKF sandbox access, and the `Db` adapter exposed to routes.
- `apps/web/src/Layers/NudgeAppLive.ts` owns the live Worker layer and runtime cache helpers. It resolves environment bindings, the dev user, durable namespaces, model config, optional Turbopuffer config, and the concrete D1-backed `Db` layer.
- `packages/db` owns persistence and row decoding. Runtime code should call the `Db` Effect service, not D1 or Drizzle directly.
- `packages/effect-services` owns reusable Nudge Engine workflows such as primitive Loop Composition, daily note analysis preparation, memory indexing, and OKF projection. Routes and App Surfaces supply platform adapters; they should not recreate Engine workflow sequencing.
- `packages/surface` owns shared App Surface logic that is not presentation-specific, such as local draft policy, Convex note patch payloads, local date formatting, and signal preview text. Web, desktop, and Raycast should depend on this package instead of copying helpers into each surface.
- `apps/web/src/index.ts` owns Cloudflare Agent and Workflow entrypoints. Durable background work lives there until a repeated reactor pattern justifies a deeper module.
- `apps/web/src/api-contract.ts` owns public OpenAPI/oRPC input and output schemas.

## Practices Borrowed From T3 Code

- Name composition seams. If runtime assembly grows, add named layer groups before adding anonymous setup inside route handlers.
- Decode at trust boundaries. Request JSON, provider responses, persisted strings, metadata, and MCP payloads must become validated domain values before domain logic sees them.
- Test through public seams. Prefer Hono routes, Effect services with memory adapters, Workers Workflow behavior, and user-visible UI behavior over private helper tests.
- Use deterministic async seams when background reactors appear. Add a `drain()` or typed receipt only when tests would otherwise sleep or poll.
- Turn repeated review comments into executable checks. Keep custom guards narrow and tied to mistakes this repo has actually made.

## What Not To Copy

- Do not migrate to t3code's Node/Bun server runtime, WebSocket RPC, SQLite lifecycle, desktop provider registry, or DPoP/OAuth server stack. The API implementation layer is Effect-native, but the public HTTP adapter remains the current Worker/oRPC stack until a separate client-contract migration earns replacing it with `@effect/platform` `HttpApi`.
- Do not split every module into `Services/` and `Layers/`. The Worker app runtime has earned the split; other modules still need two adapters, test pressure, or module size before the locality is real.
- Do not introduce an event-sourced OrchestrationEngine until replay, fanout projections, or cross-agent command dedupe are actual production pressure.
- Do not add t3code-style release/smoke/deploy jobs until `bun run check` and the existing deploy flow miss real regressions.

## Split Rules

Split a Nudge module only when at least one is true:

- The interface is stable and the implementation is forcing route handlers or UI code to know too much.
- Two real adapters exist, such as memory and durable storage, or test and production adapters that cannot stay tiny.
- Tests need to wait for async work and are starting to sleep or poll.
- The module has become the place where Capture, Signal, Context, Frame, Synthesis, Proposal, Review, Commitment, Outcome, or Loop Composition rules are leaking into unrelated code.
- App Surface behavior would otherwise be copied between web, desktop, Raycast, and iOS instead of living behind `packages/surface` or the Nudge Engine.

Otherwise keep the module boring and local.

## API Action And DB Query Files

When an OpenAPI/oRPC handler grows beyond direct wiring, extract it by action name:

- `apps/web/src/api/actions/{action-name}.ts` owns the service/use-case shape, for example `list-calendar-days.ts`. It translates `ApiContext` plus validated route input into an `Effect` whose success value matches the response contract.
- `apps/web/src/api/db/{read-or-write-name}.ts` owns the DB read/write group needed by that action. These files call the `DbService` interface and return `Effect`; they must not import Convex, D1, Drizzle, or storage clients directly unless they are an explicit platform adapter such as trace-cache reads.
- `apps/web/src/api-router.ts` stays thin: install the contract handler, delegate to the action function, and run the returned `Effect` through the request `ApiContext`.

Prefer this split for named read models, multi-step writes, response shaping, or repeated query groups. Do not create a pass-through DB query file for a single `DbService` call unless the name captures a real product read model.
