# Architecture Seed

## Stack

- Cloudflare Workers
- Cloudflare Agents SDK
- Hono
- Effect TS
- D1
- Workers cron

Later candidates:

- Vectorize for semantic memory retrieval
- Cloudflare Sandbox for safe automation and code/tool experiments
- Browser tools for web tasks
- MCP for external services
- Queues for async evaluation and reflection jobs

## Core Domain Objects

### Event

Raw interaction or scheduled job result. Events are append-only.

Examples:

- check-in submitted
- plan generated
- user rated advice
- weekly review completed
- memory proposed
- skill retired

### Memory

Distilled user knowledge derived from events.

Fields to consider:

- id
- user id
- kind
- content
- source event ids
- confidence
- scope
- created at
- last confirmed at
- retired at
- conflict group

Memory is not one thing. Split at least into episodic, semantic, procedural, goal, and governance memory. See `memory-strategy.md`.

### Skill

Reusable behavior that can improve over time.

Examples:

- morning planning routine
- evening reflection routine
- blocker recovery routine
- goal decomposition routine
- weekly review routine

Fields to consider:

- id
- name
- version
- status
- prompt/procedure
- activation criteria
- evaluation history
- created from event ids
- retired reason

### Harness

Versioned orchestration policy.

Includes:

- model choice
- system prompt
- tool policy
- memory retrieval policy
- skill selection policy
- evaluator rubric
- fallback behavior

### Evaluation

Judgment about an output, memory, skill, or harness version.

Types:

- user rating
- LLM judge
- regression check
- behavioral metric
- longitudinal trend

## Initial API Shape

```txt
POST /check-ins
GET  /today
POST /goals
GET  /goals
POST /feedback
GET  /reviews/weekly/current
```

## Scheduled Jobs

- morning plan
- evening reflection
- weekly review
- memory consolidation
- skill hygiene
- harness proposal review

## Evolution Policy

Autonomous writes are allowed for raw events and draft proposals.

Activation requires evaluation.

Production behavior changes require:

1. proposed artifact version
2. evaluator score
3. non-regression check
4. rollback pointer
5. explicit activation rule

## Effect TS Boundary

Use Effect TS for the application core:

- `ConfigService`
- `DbService`
- `MemoryService`
- `SkillService`
- `HarnessService`
- `EvaluationService`
- `SchedulerService`
- `ModelService`

Cloudflare/Hono should be a thin adapter around Effect workflows.
