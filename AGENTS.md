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

## Agent Skills

### TDD

Use `tdd` for all product implementation and bug fixes. Follow red-green-refactor and keep each cycle focused on one observable behavior.

### Architecture

Use `improve-codebase-architecture` when a slice reveals shallow modules, weak seams, hard-to-test behavior, or architecture that makes the Daily Operating Loop harder to evolve.

### Planning

Use `grill-with-docs` for major product or architecture decisions that should update `CONTEXT.md` or create ADRs.

Use `to-prd` and `to-issues` when turning product decisions into durable specs and implementation slices.
