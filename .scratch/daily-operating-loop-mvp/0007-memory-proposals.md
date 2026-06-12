# Memory Proposals

Type: AFK

## Parent

`docs/prd/daily-operating-loop-mvp.md`

## What to build

Turn manual signals into source-linked proposed memories that wait in the Review Queue before becoming active. The slice should prove the memory lifecycle from event evidence to Review Queue decision to active memory.

## Acceptance criteria

- [ ] Memory tables exist for memory items, memory sources, memory edges, and memory evaluations.
- [ ] A service can create proposed memories from check-in or reflection events.
- [ ] Every proposed memory links to at least one source event.
- [ ] Proposed memories create `memory_proposal` Review Queue items.
- [ ] Accepting a memory proposal promotes it to active memory.
- [ ] Editing a memory proposal stores the edited content and promotes the edited version when accepted.
- [ ] Rejecting a memory proposal records rejection and prevents activation.
- [ ] Tests cover source-link integrity, accept/edit/reject behavior, sensitivity/status fields, and user scoping.

## Blocked by

- `0003-manual-check-ins.md`
- `0006-review-queue-foundation.md`
