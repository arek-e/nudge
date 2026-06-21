# Resilience

Lares treats retries as normal, not exceptional. Durable mutating paths must be safe to replay after client timeouts, Worker restarts, Workflow retries, and D1 transient pressure.

## Current Guarantees

- Capture writes accept an optional `idempotencyKey`; retries with the same user/key return the original Signal.
- Synthesis generation uses a deterministic fingerprint so the same frame/input set converges on one Synthesis.
- Proposal generation uses a natural uniqueness key on synthesis/kind/title/body.
- Review, Commitment, and Outcome writes use one-row-per-source invariants so retries return the original terminal record.
- Durable Workflow steps use bounded exponential backoff via `durableWorkflowStepConfig`.
- Durable Workflow step names are versioned with `workflowStepName`, for example `v1.daily-digest-health-check`.
- Transient storage/backpressure errors return `503` with `Retry-After` instead of generic `500`.

## Workflow Upgrades

Workflow payloads carry a `workflowVersion`, and old payloads default to version 1. Do not change the meaning or output shape of an existing `step.do` name. If a step contract changes, add a new workflow version and new step names such as `v2.synthesize`; keep the old branch until in-flight v1 instances have drained.

## Cleanup Boundary

Trace-cache rows are disposable and pruned by the observability adapter. Domain rows such as Signals, Syntheses, Proposals, Reviews, Commitments, and Outcomes are personal history, so they are not auto-deleted as retry cleanup. Any future retention policy must be explicit and user-visible.
