# Scaffold Cloudflare Monorepo

Type: AFK

## Parent

`docs/prd/daily-operating-loop-mvp.md`

## What to build

Create the initial monorepo and single Cloudflare Worker app foundation for the Daily Operating Loop MVP. The app should be runnable locally, expose a health/version check, and include the first seams for Hono routes, Effect services, D1 migrations, Workers Workflows, and Cloudflare Agents SDK/Durable Object entrypoints without implementing product behavior yet.

## Acceptance criteria

- [ ] The repo has a workspace structure for the Worker app, domain logic, Effect services, D1 schema/migrations, evals, and future UI sharing.
- [ ] The Worker app runs locally through the project package manager and Cloudflare tooling.
- [ ] `GET /health` returns service name, environment, and basic binding availability.
- [ ] `GET /api/version` returns an app/version payload.
- [ ] The Worker app has placeholders or minimal wiring for Hono, Effect runtime, D1, Workers Workflows, and an Agents SDK/Durable Object entrypoint.
- [ ] Tests can exercise the health/version routes without depending on production Cloudflare state.

## Blocked by

None - can start immediately.
