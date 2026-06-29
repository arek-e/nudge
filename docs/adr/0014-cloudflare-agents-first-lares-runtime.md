# 0014. Cloudflare Agents First Lares Runtime

## Status

Accepted

Current state: `UserAgentSession` exists, conversation requests are request/response, and `LoopIntakeThinkAgent` uses Think for note/message interpretation. Deeper sub-agent orchestration and streaming are still future slices.

## Context

Lares should behave like a private operating loop run by agents, not like a form-based app with a chatbot bolted on. The core loop still uses the primitive chain Capture -> Signal -> Frame -> Synthesis -> Proposal -> Review -> Commitment -> Outcome, but the user-facing interaction should be: tell Lares what is happening, Lares drafts loop operations, and the user reviews before commitments or actions are created.

Cloudflare Agents now provides the runtime primitives we need: durable agent identity, per-agent state and SQLite, sub-agents, agent tools, skills, Workflows integration, scheduling, and Think for full chat/memory/tool orchestration.

## Decision

Use Cloudflare Agents as the Lares runtime boundary.

- `UserAgentSession` is the parent orchestrator for one user/conversation boundary.
- Domain-specific sub-agents own isolated responsibilities, starting with `LoopIntakeThinkAgent` for message intake, note extraction, and reviewable draft creation.
- D1 remains the canonical user data store.
- Agent-local state/SQLite is for runtime state, sub-agent registries, tool runs, workflow tracking, and conversational memory.
- Effect services remain the domain seam for loop primitives.
- Workers Workflows are used for durable multi-step jobs that outlive one request or require waits/retries/approval.
- Think is the harness for model-backed note extraction and the path for future streaming chat, session memory, skills, and model-selected tools.

## Consequences

- Agents orchestrate the loop; UI is a review/control surface.
- Tools must be read-first or draft-first by default.
- Human review stays required before creating commitments or taking external actions.
- Sub-agents should be named by stable domain role, not implementation detail.
- Think adoption should continue as vertical slices around one model-backed turn at a time, not as a wholesale rewrite.
