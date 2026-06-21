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

## Reference Codebases

Use these repositories as learning references, not as code-copy sources:

- `anomalyco/opencode`: agent UX, tool execution, sessions, terminal-first interaction, Bun/TypeScript architecture.
- `twentyhq/twenty`: large TypeScript product architecture, CRM-style domain modeling, customizable records, polished workflow surfaces.
- `midday-ai/midday`: polished productivity SaaS, assistant embedded in real user workflows, financial/work dashboard UX.
- `kriasoft/react-starter-kit`: close stack match for Bun, React, Cloudflare Workers, Drizzle, TanStack Router, and SaaS app structure.
- `cloudflare/agents`: Cloudflare-native agent sessions, Durable Object-backed state, tools, and agent orchestration patterns.
- `Effect-TS/effect` and `Effect-TS/effect-smol`: canonical Effect service, layer, workflow, error, and test patterns, especially for Effect v4-style APIs.
- `SonicJs-Org/sonicjs`: Cloudflare Workers, Hono, D1/R2, edge-native app structure.
- `cloudflare/chanfana`: Hono/OpenAPI patterns on Workers.
- `supermemoryai/backend-api-kit`: Hono, Workers, D1, and Drizzle backend template patterns.
- `zpg6/better-auth-cloudflare`: auth integration across Cloudflare D1, KV, R2, and related resources.
- `PaulJPhilp/EffectPatterns`: practical Effect recipes and examples.
- `typeonce-dev/sync-engine-web`: React, TanStack Router, Effect, and sync-engine architecture.
- `facebookresearch/HyperAgents`: archive/evaluator/meta-agent loop inspiration; avoid direct implementation dependency.

Priority shortlist for implementation research:

1. `anomalyco/opencode` for agent UX and tool/session patterns.
2. `twentyhq/twenty` for rich product/domain architecture.
3. `midday-ai/midday` for polished workflow assistant UX.
4. `kriasoft/react-starter-kit` for the closest app stack shape.
5. `cloudflare/agents` for Cloudflare-native agent sessions.
6. `Effect-TS/effect` and `Effect-TS/effect-smol` for service architecture.

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
