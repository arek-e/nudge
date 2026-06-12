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

Before implementing framework/tooling-specific code, check the relevant opencode reference and follow its current conventions:

- `effect-smol` for Effect v4 service, layer, workflow, and test patterns.
- `cloudflare-agents` for Cloudflare Agents SDK and Durable Object-backed agent sessions.
- `cloudflare-workers-sdk` for Workers, D1, Durable Objects, Workers Workflows, Wrangler, and local development behavior.
- `hono` for Worker-native routing and route tests.
- `bun` for Bun workspaces, catalogs, scripts, and test runner behavior.
- `oxc` for Oxlint/Oxfmt configuration, import sorting, Tailwind class sorting, and JS plugin support.

## Mistakes and Gotchas

- Do not write double assertions like `as unknown as SomeType`. They hide type problems and make tests lie. Prefer typed ports, small interfaces, `Pick<>`, framework-provided test adapters, or explicit test doubles that satisfy the smallest public shape being exercised.

## Agent Skills

### TDD

Use `tdd` for all product implementation and bug fixes. Follow red-green-refactor and keep each cycle focused on one observable behavior.

### Architecture

Use `improve-codebase-architecture` when a slice reveals shallow modules, weak seams, hard-to-test behavior, or architecture that makes the Daily Operating Loop harder to evolve.

### Planning

Use `grill-with-docs` for major product or architecture decisions that should update `CONTEXT.md` or create ADRs.

Use `to-prd` and `to-issues` when turning product decisions into durable specs and implementation slices.
