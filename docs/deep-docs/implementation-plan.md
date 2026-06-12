# Implementation Plan

Date: 2026-06-11

## Objective

Begin implementation with the smallest product loop that proves the project thesis:

```txt
signals -> memory -> understanding -> decision -> action -> feedback -> adaptation
```

The MVP should not start as a generic chatbot. It should start as a Cloudflare-native personal memory OS with a daily operating loop.

## Research-Grounded Bet

Build:

```txt
Daily Operator + Project Copilot + Memory OS
```

Use Cloudflare as the deployed runtime:

- Cloudflare Workers for the app/API runtime.
- Hono for thin HTTP routing.
- Effect TS for core workflows, services, errors, retries, and dependency injection.
- Observability from the first slice: request ids, structured logs, Server-Timing headers, Effect spans/log annotations, meaningful Workers Workflow step names, Cloudflare Agents diagnostics-channel events, and later OTLP export through Effect observability layers.
- D1 for source-linked events, memories, skills, harness versions, evaluations, and evolution records.
- Drizzle ORM for typed schema/repository implementation behind an Effect database service port, with D1 as the first adapter and future provider swaps isolated to the database package.
- Cloudflare Agents SDK and Durable Objects for live per-user agent/session coordination, Review Queue waits, and Resume Token wakeups.
- Workers Workflows for long-running multi-step jobs such as Digest generation, calendar sync, memory consolidation, and Human-in-the-Loop pause/resume.
- Workers cron for morning, evening, weekly, and consolidation jobs.
- Queues later for sync/evaluation fanout once cron/API work becomes too heavy.
- Vectorize later, after relational memory and source links prove useful.
- Wrangler-first infrastructure: `wrangler.jsonc` owns Worker-native bindings and deployments; Terraform/Pulumi/SST are deferred until account/zone-level infrastructure needs justify them.

Do not build directly on Mem0, Letta, or HyperAgents. Use them as references. The implementation should stay Cloudflare-native and should apply the research lessons: explicit memory operations, versioned skills/harnesses, evaluation before activation, retirement, rollback, and user-visible provenance.

## MVP Wedge

### Initial Inputs

- Manual morning/evening check-ins.
- Read-only calendar signals.
- Manually entered Relationship Memory.
- Local/project deep-docs as project context.

### Initial Outputs

- Today brief.
- Today focus recommendation.
- Commitment list.
- Digest of missed/new calendar and manual signals.
- Relationship follow-up suggestions.
- Evening reflection.
- Proposed memories.
- Proposed routine/skill improvements.

### Explicit Non-Goals For The First Build

- No Gmail in the first loop.
- No GitHub as a first-class source unless the MVP explicitly shifts toward Project Copilot.
- No autonomous external actions.
- No generated-code execution.
- No self-modifying production behavior.
- No vector search dependency.
- No native mobile app.
- No complex graph visualization before memory provenance is working.

## Implementation Phases

### Phase 0: Repo And Runtime Foundation

Goal: create a deployable Cloudflare app skeleton with testable domain services.

Start as a monorepo with one Cloudflare Worker app. Keep clear internal boundaries so API, workflows, agent session coordination, and domain services can be split later if needed.

Start in single-user local/dev mode, but include `user_id` on every durable table from day one so real authentication can be added before deployed private usage without reshaping the schema.

Suggested structure:

```txt
apps/web/                  # Cloudflare Worker app: PWA UI, Hono routes, Workflows, Agents SDK entrypoints
packages/domain/           # Product/domain types and pure logic
packages/effect-services/  # Effect service definitions and workflows
packages/db/               # D1 schema, migrations, repositories
packages/evals/            # Golden cases, evaluators, result comparison
packages/ui/               # Shared UI components when the PWA grows
docs/                      # Deep docs, ADRs, agent docs
```

Deliverables:

- TypeScript project scaffold.
- Cloudflare Worker entrypoint.
- Hono app with health route.
- Effect runtime boundary.
- D1 binding and migration setup.
- Workers Workflows binding and one minimal workflow scaffold.
- Local development with `wrangler`.
- Basic test setup.

Suggested routes:

```txt
GET /health
GET /api/version
```

Acceptance criteria:

- Worker runs locally.
- `/health` returns service, environment, and migration status.
- D1 migrations can run locally and remotely.
- A minimal Workers Workflow can be triggered locally for a no-op or health-check run.
- Effect services can be exercised in tests without Cloudflare adapters.

### Phase 1: Event Log And Manual Check-Ins

Goal: establish append-only raw events as the source of truth and run the first Digest workflow over manual inputs.

Core tables:

```txt
users
events
```

Initial event types:

```txt
manual_check_in_submitted
daily_digest_requested
daily_digest_generated
evening_reflection_submitted
feedback_submitted
```

Routes:

```txt
POST /api/check-ins
GET  /api/events/recent
POST /api/digests/daily/run
```

Effect services:

- `ConfigService`
- `AuthService`
- `DbService`
- `EventService`
- `DigestWorkflow`

Acceptance criteria:

- User can submit a check-in.
- Check-in is stored as an immutable event.
- Recent events can be listed for audit/debugging.
- Event payloads include source, occurred time, user id, and schema version.
- Daily Digest workflow can be triggered and writes requested/generated events.

### Phase 2: Structured Memory Inbox

Goal: turn check-ins into proposed, source-linked memories and Review Queue items that the user can inspect and correct.

Core tables:

```txt
memory_items
memory_sources
memory_edges
memory_evaluations
review_queue_items
resume_tokens
```

Memory kinds:

```txt
episodic | semantic | procedural | goal | governance
```

Memory statuses:

```txt
proposed | active | stale | retired | rejected
```

Routes:

```txt
GET  /api/memory/inbox
POST /api/memory/:id/accept
POST /api/memory/:id/reject
POST /api/memory/:id/edit
GET  /api/memory/active
GET  /api/review-queue
POST /api/review-queue/:id/accept
POST /api/review-queue/:id/reject
POST /api/review-queue/:id/edit
```

Effect services:

- `MemoryService`
- `ModelService`

Acceptance criteria:

- New check-ins can produce proposed memories.
- Every proposed memory links to one or more source events.
- User can accept, edit, reject, or mark memory sensitive.
- Approved Review Queue decisions automatically resume the workflow or agent that created the proposal via a Resume Token, except for high-risk external writes that require an explicit final execution step.
- Resumed workflows write a completion summary back to the Review Queue item so the user can see what happened after approval.
- Sensitive/stable memories are not silently promoted.
- Active memories are retrievable by kind, domain, confidence, sensitivity, and recency.

### Phase 3: Today Loop

Goal: produce a useful daily brief from events, active memory, goals, commitments, and current context.

Core additions:

```txt
goals
commitments
memory_projections
```

Routes:

```txt
GET  /api/today
POST /api/goals
GET  /api/goals
POST /api/commitments/:id/status
POST /api/feedback
```

Today brief sections:

- What changed since yesterday.
- Today's focus.
- Calendar commitments, initially manual or stubbed before calendar sync.
- Waiting-for / promised-by-me items.
- Relevant active goals.
- Suggested next actions.
- Source-linked rationale.

Effect services:

- `GoalService`
- `CommitmentService`
- `ProjectionService`
- `BriefingService`
- `EvaluationService`

Acceptance criteria:

- `/api/today` builds a memory projection instead of dumping the whole event log into context.
- Today brief cites the memories/events used.
- User can rate the brief and individual recommendations.
- Feedback is stored as evaluation data.

### Phase 4: Responsive Web/PWA MVP

Goal: expose the core trust surfaces before building more integrations.

Views:

- Today.
- Review Queue.
- Goals.
- Graph-lite.
- Privacy and Consent Grants.

Graph-lite should start as an inspectable relationship list, not a full graph renderer. It should answer why a memory or recommendation exists.

UI capabilities:

- Quick check-in capture.
- Review today's brief.
- Accept/edit/reject proposed memories, Action Points, calendar drafts, Relationship Memory updates, and routine changes.
- Approve one-off Consent Grants through the Review Queue.
- Manage durable Consent Grants in a Privacy settings surface.
- Inspect memory source evidence.
- Create/update goals.
- Rate recommendations.

Acceptance criteria:

- Works on desktop and mobile web.
- User can complete the whole loop without API tooling.
- Memory provenance is visible from the UI.
- The UI distinguishes facts, hypotheses, suggestions, and actions.

### Phase 5: Cloudflare Agent Session

Goal: introduce durable agent behavior after the data model and core loop are stable.

Use the Cloudflare Agents SDK and Durable Objects for:

- Per-user durable session state.
- Tool orchestration over Event, Memory, Goal, Commitment, and Briefing services.
- Conversation continuity.
- Draft-only action proposals.
- Review Queue wait states and Resume Token wakeups.

Use Workers Workflows for:

- Digest generation.
- Calendar sync.
- Memory consolidation.
- Human-in-the-Loop pause/resume flows.
- Routine and harness evaluation jobs.

Agent tools should be explicit:

```txt
record_event
propose_memory
retrieve_memory_projection
generate_today_brief
record_feedback
propose_commitment
propose_skill_update
```

Acceptance criteria:

- Agent can answer questions using active memories and source links.
- Agent can propose memory writes but not silently activate sensitive/stable memories.
- Agent can generate the same today loop through service calls, not hidden prompt-only state.

### Phase 6: Scheduled Loops

Goal: make the product proactive but safe.

Cron jobs:

```txt
morning_plan
evening_reflection_prompt
weekly_review
memory_consolidation
skill_hygiene
```

Acceptance criteria:

- Morning job creates a draft daily brief event.
- Evening job creates reflection prompts and captures outcomes.
- Weekly job summarizes goal progress, repeated blockers, stale commitments, and memory candidates.
- Memory consolidation proposes, deduplicates, or retires memories but does not erase raw events.

### Phase 7: Read-Only Integrations

Goal: add real external signals without compromising trust.

Order:

1. Calendar read-only.
2. GitHub read-only, only when Project Copilot becomes a primary mode.
3. Project docs/deep-docs ingestion.
4. Gmail read-only later.

Integration rules:

- Explicit opt-in per source.
- Least-privilege scopes.
- Sync jobs are auditable.
- Raw integration data becomes events first.
- Derived memories are proposed before activation.
- External actions stay draft-first.

GitHub outputs:

- Project status summary.
- Stale PR/issue detection.
- Engineering daily brief.
- Project memory.

Calendar outputs:

- Daily schedule context.
- Commitment extraction.
- Conflict detection.
- Meeting prep candidates.

Acceptance criteria:

- User can enable/disable each source.
- Synced records produce source events.
- Today brief improves measurably with integration signals.

### Phase 8: Evaluated Skill And Harness Evolution

Goal: add safe self-improvement after the daily loop has enough feedback data.

Core tables:

```txt
skills
skill_versions
harness_versions
evaluations
evolution_runs
golden_cases
golden_case_results
```

Initial skills:

- Daily Digest skill.
- Morning planning routine.
- Evening reflection routine.
- Blocker recovery routine.
- Weekly review routine.

Evolution policy:

- Agent may propose a new skill or harness version.
- Evolution is per-user by default.
- Proposed version stores parent pointer, rationale, source events, and evaluation rubric.
- Evaluator scores proposal on usefulness, correctness, safety, and regression risk using both live user feedback and offline golden cases.
- Golden cases capture representative historical situations, expected constraints, source evidence, and failure modes that new versions must not regress.
- Golden cases may be manually authored or proposed by the system from corrections, rejections, and failures; system-proposed golden cases go through the Review Queue before becoming active evals.
- Golden cases are per-user private by default. Any use in shared/global evals requires a Consent Grant that specifies shared content, purpose, redactions, duration, and revocation behavior.
- User or explicit activation rule promotes it.
- Prior version remains rollbackable.
- Promotion from a per-user artifact to a global template requires maintainer/product review and evaluation evidence.
- Product code is not self-modified by agents; code changes follow normal engineering/deployment review.

Acceptance criteria:

- Daily Digest skill can be versioned, including prompt, sections, source selection policy, memory selection policy, Action Point style, and evaluation rubric.
- Feedback can identify whether a routine is improving.
- Golden-case evaluation can compare a proposed Daily Digest skill version against the active version before activation.
- A low-value routine can be retired.
- No production behavior changes without evaluation and rollback metadata.

## Initial Data Model

Minimum D1 tables for the first four phases:

```txt
users
events
memory_items
memory_sources
memory_edges
memory_evaluations
memory_projections
goals
commitments
recommendations
feedback
consent_grants
```

Add in later phases:

```txt
integration_accounts
integration_sync_runs
skills
skill_versions
harness_versions
evaluations
evolution_runs
```

Consent Grant schema should exist early as a privacy guardrail, but the full Privacy and Consent Grants UI can wait until shared/global evals or sharing workflows exist. Until then, no sharing path should execute unless a valid grant exists, and revocation can be handled through a simple endpoint or development/admin surface.

## Service Boundary

Cloudflare/Hono should remain thin. Application behavior should live in Effect workflows.

Initial services:

```txt
ConfigService
AuthService
DbService
EventService
MemoryService
GoalService
CommitmentService
ProjectionService
BriefingService
FeedbackService
EvaluationService
ModelService
SchedulerService
```

Adapter layer:

- Hono routes.
- Cloudflare bindings.
- Cron handlers.
- Agents SDK session wrapper.
- Integration OAuth/sync adapters.

## Core Loop Milestone

The first meaningful product milestone is complete when this loop works end to end:

1. User submits a morning check-in.
2. System stores it as an event.
3. System proposes memories from the check-in.
4. User accepts/edits/rejects those memories.
5. System generates a source-linked today brief from active memory and recent events.
6. User chooses or edits the recommended focus.
7. User submits evening reflection and rates whether the plan helped.
8. System records feedback and updates memory/recommendation worth counters.
9. Weekly job identifies one repeated blocker or stale goal.
10. System proposes a small routine change, but does not activate it without evaluation.

## Build Order Summary

1. Scaffold Cloudflare Worker, Hono, Effect, D1, tests.
2. Implement append-only events and manual check-ins.
3. Implement proposed/active memory with source links.
4. Implement Today brief from task-specific memory projection.
5. Build responsive PWA with Today, Memory Inbox, Goals, Graph-lite.
6. Add Cloudflare Agents SDK session wrapper around existing services.
7. Add cron jobs for morning/evening/weekly/consolidation loops.
8. Add GitHub read-only sync.
9. Add calendar read-only sync.
10. Add evaluated skill/harness versioning once feedback exists.

## Success Metrics

MVP should prove three things:

- Memory quality: accepted memory rate, correction rate, stale-memory rate, source coverage.
- Decision usefulness: daily brief rating, focus recommendation accepted/edited/rejected, completed recommendations.
- Adaptation: repeated blocker detection, routine proposal usefulness, improvement in one recurring workflow over multiple weeks.

## First Sprint Recommendation

Start with Phase 0 and Phase 1 only.

Concrete first sprint scope:

- Create TypeScript Cloudflare Worker project.
- Add Hono and Effect.
- Add D1 migrations for `users` and `events`.
- Implement `POST /api/check-ins`.
- Implement `GET /api/events/recent`.
- Add local tests for event creation and validation.
- Deploy a basic worker once local flow is stable.

This gives the product its foundation: trusted raw signals. Everything else depends on this event log being boring, auditable, and correct.
