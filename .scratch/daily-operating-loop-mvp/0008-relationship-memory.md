# Relationship Memory

Type: AFK

## Parent

`docs/prd/daily-operating-loop-mvp.md`

## What to build

Add manually entered Relationship Memory and the first People Graph representation. The user should be able to add people, important dates, relationship facts, and connections between people, with changes represented as source-linked memory and Review Queue items where appropriate.

## Acceptance criteria

- [ ] The system can represent a person, important dates, relationship notes, preferences, and follow-up context as Relationship Memory.
- [ ] The system can represent relationships between people in the People Graph.
- [ ] Manually entered Relationship Memory is user-scoped and source-linked to an event or explicit manual source.
- [ ] Relationship Memory updates can create `relationship_memory_update` Review Queue items when they need confirmation.
- [ ] Relationship Memory can be retrieved for Digest generation.
- [ ] Tests cover person creation, birthday/important-date storage, relationship edges, Review Queue confirmation, and user scoping.

## Blocked by

- `0007-memory-proposals.md`
