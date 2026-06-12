# Manual Check-Ins

Type: AFK

## Parent

`docs/prd/daily-operating-loop-mvp.md`

## What to build

Allow the user to submit morning check-ins and evening reflections as the first manual signal source for the Daily Operating Loop. Submissions should become append-only events and be visible in recent event history.

## Acceptance criteria

- [ ] `POST /api/check-ins` accepts a morning check-in payload and writes a `manual_check_in_submitted` event.
- [ ] `POST /api/reflections/evening` accepts an evening reflection payload and writes an `evening_reflection_submitted` event.
- [ ] The API validates required fields and rejects malformed submissions without writing events.
- [ ] Recent event history shows check-ins and reflections with source metadata.
- [ ] Tests cover successful submission, validation failure, event payload shape, and user scoping.

## Blocked by

- `0002-event-log-and-dev-auth.md`
