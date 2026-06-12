# Daily Operating Loop MVP PRD

## Problem Statement

Personal work, calendar commitments, relationship context, and daily reflections accumulate across tools faster than the user can reliably process them. The user needs a short Digest of what changed or was missed, concrete Action Points, and a trusted way for the system to remember useful context without silently taking control.

The product must begin as a personal operating layer, not a generic chatbot. It should help the user move through a Daily Operating Loop: collect signals, summarize what changed, recommend focus and Action Points, capture reflection, and learn from feedback.

## Solution

Build a Cloudflare-native Daily Operating Loop MVP for a single-user dev mode. The first loop uses manual check-ins, read-only calendar signals, manually entered Relationship Memory, and project/product docs. It produces a Digest, suggested Action Points, proposed memories, and Review Queue items that can be accepted, edited, or rejected through a Human-in-the-Loop flow.

The system starts read-first and draft-first. External writes and behavior-changing automation are out of scope for the first build. Future write capabilities must be evaluated, source-grounded, reversible, and approved through Human-in-the-Loop flows.

## User Stories

1. As the user, I want to submit a morning check-in, so that the system knows what is currently on my mind.
2. As the user, I want to submit an evening reflection, so that the system can learn what happened and what helped.
3. As the user, I want a short Digest of missed or new information, so that I can catch up without reading every source directly.
4. As the user, I want the Digest to focus on changes since the last loop, so that it does not repeat stale information.
5. As the user, I want the Digest to include calendar context, so that I can see upcoming commitments and schedule changes.
6. As the user, I want the Digest to include relationship follow-up suggestions, so that important people and dates do not slip.
7. As the user, I want Action Points instead of vague advice, so that I can decide what to do next.
8. As the user, I want Action Points to be source-linked, so that I understand why they were suggested.
9. As the user, I want to accept an Action Point, so that it becomes part of today’s plan.
10. As the user, I want to edit an Action Point, so that the system can adapt to my wording and priorities.
11. As the user, I want to reject an Action Point, so that the system learns what was not useful.
12. As the user, I want to mark an Action Point completed later, so that outcome feedback improves future Digests.
13. As the user, I want proposed memories to wait for review, so that the system does not silently store sensitive or incorrect context.
14. As the user, I want to accept, edit, or reject proposed memories, so that memory remains correctable.
15. As the user, I want every memory to show source evidence, so that I can audit why the system believes it.
16. As the user, I want Relationship Memory for people, birthdays, important dates, and how people know each other, so that personal context is available when it matters.
17. As the user, I want a People Graph underneath Relationship Memory, so that relationships between people can be represented without turning the product into a sales CRM.
18. As the user, I want to manually enter Relationship Memory in the MVP, so that the product can be useful before importing contacts or email.
19. As the user, I want a unified Review Queue, so that proposed memories, Action Points, calendar drafts, Relationship Memory updates, routine changes, and Consent Grants are reviewed in one place.
20. As the user, I want Review Queue items to clearly distinguish facts, hypotheses, suggestions, and actions, so that I know what I am approving.
21. As the user, I want accepted Review Queue items to automatically resume the workflow that created them, so that agents can continue after Human-in-the-Loop decisions.
22. As the user, I want resumed workflows to write a completion summary, so that I can see what happened after approval.
23. As the user, I want rejected Review Queue items to feed back into future behavior, so that the system does not repeat rejected suggestions.
24. As the user, I want multiple agents or workflows to pause on Review Queue items independently, so that one pending decision does not block unrelated work.
25. As the user, I want calendar access to start read-only, so that I can trust the system before it writes to external tools.
26. As the user, I want future calendar writes to be drafts first, so that I approve changes before execution.
27. As the user, I want Consent Grants to specify exactly what may be shared, so that privacy decisions are explicit.
28. As the user, I want golden cases and personal feedback to stay private by default, so that my data is not used globally without consent.
29. As the user, I want to revoke Consent Grants, so that sharing permissions do not last forever by accident.
30. As the user, I want to rate a Digest as useful, mixed, or not useful, so that the Digest Skill can improve.
31. As the user, I want to rate Digest sections with keep, change, or remove, so that future Digests are better structured.
32. As the user, I want the system to use golden cases as well as live feedback, so that Digest Skill changes do not regress important scenarios.
33. As the user, I want the Daily Digest Skill to evolve per-user first, so that my preferences do not change global product behavior.
34. As the maintainer, I want per-user evolved skills to require review before becoming global templates, so that one user’s context does not leak or overfit product defaults.
35. As the maintainer, I want the product codebase to remain under normal engineering review, so that self-evolution does not silently edit deployed code.
36. As the developer, I want a monorepo with a single Worker app first, so that the initial loop is easy to deploy and reason about.
37. As the developer, I want Cloudflare Agents SDK and Durable Objects to own live session coordination, so that per-user agent state and Resume Tokens have a durable runtime home.
38. As the developer, I want D1 to own durable source-of-truth records, so that events, memories, Review Queue decisions, and evaluations are queryable and auditable.
39. As the developer, I want Workers Workflows from the first build, so that the Digest flow can grow into scheduled and Human-in-the-Loop orchestration without a rewrite.
40. As the developer, I want an AuthService seam with a hardcoded dev user, so that real auth can be swapped in later without reshaping domain services.

## Implementation Decisions

- The first product loop is the Daily Operating Loop, not Project Copilot.
- The first signal sources are manual check-ins, read-only calendar data, manually entered Relationship Memory, and project/product docs.
- GitHub is not a first-class MVP source. It may be added later if Project Copilot becomes a primary mode.
- The first Digest summarizes deltas since the last loop, not an unbounded feed of all recent activity.
- Action Points are concrete suggested next steps. The system should avoid vague advice.
- Relationship Memory is the product/domain term for people, important dates, relationship context, preferences, past interactions, and follow-ups.
- People Graph is the underlying structure for representing people and relationships.
- The product is read-first and draft-first. External writes are excluded from the first build.
- Human-in-the-Loop approval is required for sensitive memory changes, external writes, Consent Grants, and behavior-changing automation.
- Review Queue is the unified Human-in-the-Loop approval surface.
- Resume Tokens store enough continuation context for the original agent/workflow to resume after the Review Queue decision.
- Approved Review Queue items auto-resume the paused workflow except for high-risk external writes that require a final execution step.
- Resumed workflows write completion summaries back to their Review Queue items.
- Review Queue items are typed from day one, starting with `memory_proposal`, `action_point`, `calendar_draft`, `relationship_memory_update`, `routine_change`, and `consent_grant`.
- Cloudflare Workers serve the app/API runtime.
- Hono is the thin route adapter.
- Effect TS owns core workflows, services, errors, retries, and dependency injection.
- Cloudflare Agents SDK and Durable Objects own live per-user agent/session coordination, Review Queue waits, and Resume Token wakeups.
- Workers Workflows own long-running multi-step jobs such as Daily Digest generation, calendar sync, memory consolidation, Human-in-the-Loop pause/resume, and evaluation runs.
- D1 stores source-of-truth records: users, events, memories, Review Queue items, Resume Tokens, decisions, feedback, Consent Grants, skills, golden cases, and evaluations.
- Queues, R2, and Vectorize are later additions, not MVP dependencies.
- The repo starts as a monorepo with one Cloudflare Worker app.
- The initial app structure is `apps/web` for PWA UI, Hono routes, Workflows, and Agents SDK entrypoints; `packages/domain` for product/domain types and pure logic; `packages/effect-services` for service definitions and workflows; `packages/db` for D1 schema/migrations/repositories; `packages/evals` for golden cases and evaluators; and `packages/ui` later for shared UI.
- The MVP starts in single-user local/dev mode, but every durable table includes `user_id` from day one.
- An `AuthService` interface returns a hardcoded dev user initially and can later be backed by Clerk, WorkOS, Auth0, Ory, or Cloudflare Access.
- Daily Digest Skill is the first evolvable artifact.
- Daily Digest Skill versions include prompt, sections, source selection policy, memory selection policy, Action Point style, and evaluation rubric.
- Evolution is per-user by default.
- Product code is not self-modified by agents.
- Promotion from per-user artifact to global template requires maintainer/product review, evaluation evidence, rollback metadata, and privacy review.
- Golden cases may be manually authored or system-proposed from corrections, rejections, and failures.
- System-proposed golden cases go through the Review Queue before becoming active evals.
- Golden cases are per-user private by default.
- Shared/global eval usage requires a Consent Grant specifying content, purpose, redactions, duration, and revocation behavior.

## Testing Decisions

- Tests should verify behavior through public seams, not implementation details.
- First testing seam: API behavior through Hono routes for health, check-ins, event listing, and Digest workflow trigger.
- Second testing seam: Effect services with fake adapters for auth, DB, time, and model output.
- Third testing seam: workflow-level tests for Daily Digest generation from a fixed event/calendar/memory fixture.
- D1 repository tests should verify migrations, user scoping, event append behavior, Review Queue persistence, and source-link integrity.
- Golden-case evaluation tests should compare proposed Daily Digest Skill versions against active versions using fixed fixtures.
- Review Queue tests should verify typed items, accept/edit/reject decisions, Resume Token continuation, and completion summaries.
- Privacy tests should verify no sharing path runs without a valid Consent Grant.
- Calendar MVP tests should verify read-only ingestion/projection behavior and should not require external calendar writes.
- UI tests can start at the route/component behavior level once Today and Review Queue screens exist.

## Out of Scope

- Gmail integration.
- GitHub integration as an MVP source.
- Autonomous external writes.
- Direct calendar writes.
- Generated code execution.
- Agent self-modification of product code.
- Global template promotion without maintainer review.
- Vector search dependency.
- Native mobile app.
- Full graph visualization before Relationship Memory provenance is working.
- Full Privacy and Consent Grants UI before sharing/global eval workflows exist.
- Multi-user SaaS auth before private/deployed usage.

## Further Notes

This PRD is grounded in the ADRs in `docs/adr/` and the glossary in `CONTEXT.md`. The critical product posture is trust first: read-only integrations, source-linked memory, typed Human-in-the-Loop review, private-by-default evals, and per-user evolution before global behavior changes.

The first implementation should prove one narrow loop end to end: submit check-in, write event, trigger Daily Digest workflow, produce Digest and Action Points, record feedback, and store enough evaluation data to improve the Daily Digest Skill later.
