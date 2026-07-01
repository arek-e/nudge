# Agent Instructions

## Development Workflow

Use the `tdd` skill for implementation work.

Development should follow red-green-refactor:

1. Write one behavior-focused test through a public interface.
2. Confirm it fails for the expected reason.
3. Write the smallest implementation that makes it pass.
4. Refactor only after tests are green.
5. Repeat one vertical slice at a time.

Do not write a batch of tests first and then a batch of implementation. Prefer tracer bullets that cut through the relevant schema, service, API, workflow, and UI surface when applicable.

Tests should verify behavior, not implementation details. Prefer public seams such as Hono routes, Effect services with test adapters, Workers Workflow behavior, D1 repositories, and user-visible UI behavior.

Use the project glossary in `CONTEXT.md` for test names, issue names, and domain language. Respect ADRs in `docs/adr/` before introducing architectural changes.

Before changing app runtime layers, service seams, or module ownership, read `docs/architecture/layers-and-services.md`. It records what Vesta borrows from `pingdotgg/t3code` and what we intentionally do not copy.

Before implementing framework/tooling-specific code, check the relevant opencode reference and follow its current conventions:

- `effect-smol` for Effect v4 service, layer, workflow, and test patterns.
- `cloudflare-agents` for Cloudflare Agents SDK and Durable Object-backed agent sessions.
- `cloudflare-workers-sdk` for Workers, D1, Durable Objects, Workers Workflows, Wrangler, and local development behavior.
- `hono` for Worker-native routing and route tests.
- `bun` for Bun workspaces, catalogs, scripts, and test runner behavior.
- `oxc` for Oxlint/Oxfmt configuration, import sorting, Tailwind class sorting, and JS plugin support.

## Mistakes and Gotchas

- Do not write double assertions like `as unknown as SomeType`. They hide type problems and make tests lie. Prefer typed ports, small interfaces, `Pick<>`, framework-provided test adapters, or explicit test doubles that satisfy the smallest public shape being exercised.
- Do not use type assertions, non-null assertions, namespace imports, or aliased imports in runtime source. `bun run style:check` enforces this for `apps/**` and `packages/**` outside tests and generated declarations.
- Do not solve naming collisions with import aliases like `Context as EffectContext`. Rename the local type, derive it from an existing public type, or move the narrower type closer to its use.
- Do not type platform bindings loosely and cast at the call site. Type the binding accurately in `Env` instead, for example `DurableObjectNamespace<Sandbox>` for the Cloudflare sandbox binding.
- Do not parse request JSON, response JSON, error objects, or metadata with `as SomeShape`. Use a schema at trust boundaries, or read fields defensively with `Reflect.get` and runtime type checks.
- Do not cast stored database strings into domain unions. Decode row values with explicit functions and fail loudly on invalid persisted values.
- Do not use non-null assertions for optional bindings, DOM roots, or array indexes. Capture optional bindings before closing over them, check DOM roots explicitly, and use lookup helpers or safe defaults for indexed arrays.
- Do not use `as const` to force literal types when a return type, small typed constructor, or `satisfies` can provide the context. Use `satisfies` for config objects that must keep literal values.
- Do not wrap whole SDK modules with namespace imports just to pass them into another library. Import the named SDK functions used by the app and pass an explicit object to the wrapper.
- Do not cast React style objects to allow CSS custom properties. Define a local `CSSProperties & { [key: \`--${string}\`]: ... }` type and use it where custom variables are needed.
- Do not widen shared config helper types so framework overloads lose their literal strings. Keep literal-sensitive config typed with `satisfies` and narrow generic parameters when Cloudflare Worker APIs require exact duration strings.
- Use `Services/` plus `Layers/` for the top-level Worker runtime seam: service interfaces live in `apps/web/src/Services`, live Effect wiring lives in `apps/web/src/Layers`, and `apps/web/src/app.ts` stays focused on Hono composition, middleware installation, runtime caching, and request context.
- Do not cargo-cult that split into every module. Split a module only when two real adapters, test pressure, or module size makes the seam earn its keep.
- Do not add anonymous runtime setup inside route handlers. If composition grows, name the seam first and keep the app layer wiring in `apps/web/src/Layers`.
- Do not test new service behavior through private helpers. Use public seams: Hono routes, Effect services with memory adapters, Workers Workflow behavior, and user-visible UI behavior.
- Do not use sleeps or polling in tests for background reactors. Add a deterministic `drain()` or typed receipt when async work needs a test seam.

## Agent Skills

### TDD

Use `tdd` for all product implementation and bug fixes. Follow red-green-refactor and keep each cycle focused on one observable behavior.

### Architecture

Use `improve-codebase-architecture` when a slice reveals shallow modules, weak seams, hard-to-test behavior, or architecture that makes the Daily Operating Loop harder to evolve.

### Planning

Use `grill-with-docs` for major product or architecture decisions that should update `CONTEXT.md` or create ADRs.

Use `to-prd` and `to-issues` when turning product decisions into durable specs and implementation slices.
