# Event Log And Dev Auth

Type: AFK

## Parent

`docs/prd/daily-operating-loop-mvp.md`

## What to build

Add the durable user-scoped event log foundation. Requests should resolve a hardcoded dev user through an AuthService seam, and the system should append and read raw events in D1 with source, occurred time, schema version, and payload metadata.

## Acceptance criteria

- [ ] A `users` table exists and is seeded or created for the dev user.
- [ ] An `events` table exists with `user_id`, event type, source, occurred time, schema version, payload, and timestamps.
- [ ] AuthService returns a hardcoded dev user in local/dev mode.
- [ ] EventService can append immutable events for the current user.
- [ ] `GET /api/events/recent` lists recent events scoped to the current user.
- [ ] Tests prove events from one user scope cannot be read through another user scope, even if only dev auth is active.

## Blocked by

- `0001-scaffold-cloudflare-monorepo.md`
