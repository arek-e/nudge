# Review Queue Foundation

Type: AFK

## Parent

`docs/prd/daily-operating-loop-mvp.md`

## What to build

Build the typed Review Queue and Resume Token foundation for Human-in-the-Loop approvals. The first implementation should support creating typed review items, accepting/editing/rejecting them, and storing completion summaries after a resumed workflow finishes.

## Acceptance criteria

- [ ] Review Queue items are typed, including `memory_proposal`, `action_point`, `calendar_draft`, `relationship_memory_update`, `routine_change`, and `consent_grant`.
- [ ] Resume Tokens can store continuation context for the workflow or agent that created a Review Queue item.
- [ ] `GET /api/review-queue` lists pending and recently completed items for the current user.
- [ ] Accept, edit, and reject endpoints record decisions with actor, timestamp, and edited payload where relevant.
- [ ] Accepted items can mark a Resume Token as ready to continue.
- [ ] Resumed or simulated resumed workflows can write a completion summary back to the Review Queue item.
- [ ] Tests cover item creation, type validation, accept/edit/reject, Resume Token state, completion summaries, and user scoping.

## Blocked by

- `0002-event-log-and-dev-auth.md`
