# Memory Strategy

Date: 2026-06-11

## Bottom Line

Memory is more central to this project than generic self-improvement.

Recommended project bet:

```txt
Cloudflare-native personal memory OS + evaluated skill/harness evolution
```

HyperAgents helps with archive/evolution structure. Memory literature tells us what the product should actually be good at.

## Engineering Baselines

### Mem0

Repo: `mem0ai/mem0`

- Stars: 58,360
- Forks: 6,703
- License: Apache-2.0
- Language: Python
- Description: Universal memory layer for AI Agents

Useful primitives: add, search, update, delete, user/session/agent memory categories, metadata filters, MCP integration.

### Letta

Repo: `letta-ai/letta`

- Stars: 23,270
- Forks: 2,480
- License: Apache-2.0
- Language: Python
- Description: stateful agents with advanced memory that can learn and self-improve over time

Useful primitives: memory-first agent harness, persistent state, skills, subagents, schedules, channels, MemFS-style memory/file boundary.

### Dependency Decision

Do not build the MVP directly on Mem0 or Letta.

Use them as design references. Keep the first implementation Cloudflare-native with D1, Workers cron, Hono, Effect TS, and later Vectorize.

## Research Trends

### Agentic Memory

Memory operations are becoming explicit actions:

- when to write
- when to summarize
- when to update
- when to delete
- when to retrieve
- when to ignore memory

Design implication: expose memory operations as explicit service methods and log every operation as an event.

### Structured Memory

Flat vector search is not enough. Recent work uses event graphs, trees, semantic networks, schema-constrained memory, hierarchical consolidation, and episodic frames.

Design implication: start with relational D1 memory and source-linked events. Add vector search later. The first useful memory system should be inspectable and structured.

### Governance And Forgetting

Dynamic memory creates stale memories, false memories, memory poisoning, semantic drift, privacy leakage, and over-anchoring.

Design implication: every memory needs provenance, confidence, expiry/decay, validation status, access scope, and deletion support.

### Long Context Does Not Replace Memory

Long context can help raw recall, but memory systems win on cost and personalization after enough turns.

Design implication: keep raw event logs, but build task-specific memory projections instead of loading the whole log.

### Proactive Memory

For a personal improvement app, memory matters because it can trigger useful action before the user asks.

Design implication: scheduled jobs should query memory for latent needs: neglected goals, repeated blockers, upcoming commitments, unresolved reflections, and stale plans.

## Memory Types

### Raw Events

Append-only facts about interactions and system actions. Raw events are the ground truth. Do not edit them.

### Episodic Memory

Structured summaries of specific experiences. Use for recency, narrative continuity, and reflection.

### Semantic Memory

Stable facts and preferences about the user. Use for personalization and default behavior.

### Procedural Memory

Reusable routines, skills, and workflows. Use for repeated behavior and self-improvement.

### Goal Memory

Current objectives, priorities, constraints, and progress. Use for planning and proactive reminders.

### Governance Memory

Rules about what memory may be used for. Use for safety and trust.

## Proposed Data Model

### `events`

- `id`
- `user_id`
- `type`
- `occurred_at`
- `payload_json`
- `source`
- `trace_id`

### `memory_items`

- `id`
- `user_id`
- `kind`: episodic | semantic | procedural | goal | governance
- `content`
- `status`: proposed | active | stale | retired | rejected
- `confidence`
- `importance`
- `sensitivity`
- `valid_from`
- `valid_until`
- `last_confirmed_at`
- `created_at`
- `updated_at`
- `retired_at`

### `memory_sources`

- `memory_id`
- `event_id`
- `evidence_role`: source | contradiction | correction | evaluation

### `memory_edges`

- `from_memory_id`
- `to_memory_id`
- `relation`: supports | contradicts | elaborates | supersedes | causes | temporal_next | part_of
- `confidence`

### `memory_evaluations`

- `id`
- `memory_id`
- `event_id`
- `score_type`: useful | correct | stale | harmful | sensitive | retrieved_helped
- `score`
- `judge`: user | system | evaluator_agent
- `notes`
- `created_at`

### `memory_projections`

- `id`
- `user_id`
- `task_type`
- `query`
- `selected_memory_ids`
- `created_at`
- `token_estimate`
- `result_quality_score`

## Memory Lifecycle

1. Ingest raw event.
2. Extract candidate memories.
3. Classify memory type and sensitivity.
4. Link to source events.
5. Check contradictions and duplicates.
6. Store as proposed.
7. Evaluate or ask user for confirmation when needed.
8. Promote to active.
9. Use through task-specific projections.
10. Update scores based on outcomes.
11. Mark stale or retire when no longer useful.

## Retrieval Strategy

MVP retrieval should be hybrid but simple:

1. Select by type and task.
2. Filter by status, sensitivity, and validity window.
3. Rank by recency, importance, confidence, and Memory Worth.
4. Include source links for auditability.
5. Build a compact projection for the current task.

Later retrieval:

- Vectorize semantic search
- graph expansion
- learned retrieval policy
- user-controllable memory strength

## Memory Worth

Track per memory:

- retrieval count
- helped count
- hurt count
- ignored count
- user correction count

Approximate value:

```txt
worth = (helped + 1) / (retrieved + 2) - correction_penalty - staleness_penalty
```

Use it for ranking and retirement candidates.

## What Not To Do

- Do not store everything as one giant summary.
- Do not continuously rewrite memories without provenance.
- Do not let the model silently alter user profile facts.
- Do not rely only on vector embeddings.
- Do not use stale personal facts without confirmation.
- Do not mix private user memories with global reusable skills.

## MVP Memory Scope

Build first:

- raw event log
- active/proposed memory table
- source links
- basic memory extraction
- confirmation flow for sensitive/stable memories
- memory projection for `/today` and `/check-ins`
- scheduled memory consolidation
- memory worth counters

Defer:

- vector search
- graph traversal UI
- autonomous memory architecture evolution
- cross-user memory transfer
- model fine-tuning
- generated code execution

## Product Direction

The app should not be "a chatbot with memory".

It should be a personal memory system with an agent interface:

- remembers what happened
- understands what changed
- knows when memory is stale
- turns repeated experience into reusable routines
- uses memory proactively but safely
- lets the user inspect, correct, and delete memories
