# Calendar Read Model

Type: AFK

## Parent

`docs/prd/daily-operating-loop-mvp.md`

## What to build

Add the first read-only calendar signal path. The implementation may start with an adapter seam and local/dev calendar fixtures, but it should model calendar events as read-only signals that can be included in the Digest without enabling calendar writes.

## Acceptance criteria

- [ ] A CalendarService seam can list upcoming events for the current user.
- [ ] Local/dev fixtures or a read-only adapter can provide calendar events without external writes.
- [ ] Calendar events can be projected into Digest source context.
- [ ] Calendar-derived Digest entries cite calendar source identifiers.
- [ ] The system does not expose any calendar write endpoint in this slice.
- [ ] Tests cover read-only retrieval, projection into Digest context, source citation, and absence of write behavior.

## Blocked by

- `0004-daily-digest-workflow.md`
