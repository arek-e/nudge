# Nudge

Nudge is an adaptive operating layer for personal work, relationships, memory, and daily decision-making. This glossary keeps product language stable across docs, planning, and implementation.

## Language

**Nudge Engine**:
The durable runtime that owns Nudge's API, reasoning, persistence, review boundaries, and integrations. App Surfaces call the Engine instead of reimplementing product behavior locally.
_Avoid_: Backend as product language, duplicating Engine rules in clients

**App Surface**:
A platform-specific user interface for Nudge, such as web, Electron desktop, SwiftUI iOS, Raycast, or Siri. App Surfaces may adapt presentation and OS integration, but they should keep durable behavior behind the Nudge Engine.
_Avoid_: Treating each app as its own product logic fork

**Shared Surface Logic**:
Presentation-adjacent product behavior reused by React App Surfaces, especially web and Electron, while durable behavior and agent decisions stay behind the Nudge Engine.
_Avoid_: Rebuilding capture, editor, review, or Convex wiring separately per surface

**Agent Loop**:
The Engine-run cycle that turns Captures and Context into source-linked Syntheses, Proposals, Reviews, Commitments, and Outcomes.
_Avoid_: Client-side agent rules, silent autonomous action

**Primitive**:
A general building block that can be composed into many user-facing loops without locking Nudge into one niche workflow.
_Avoid_: Feature-specific nouns as core architecture

**Capture**:
User-authored or system-observed input recorded for later reasoning. A capture can come from typing, API integrations, calendar reads, imported files, or agent observations.
_Avoid_: Morning check-in as a core primitive

**Signal**:
An append-only record that something meaningful happened. Signals preserve source, occurrence time, schema version, and payload metadata so they can be queried, audited, and used as evidence.
_Avoid_: Raw log line, notification, unscoped event dump

**Context**:
Information available for reasoning. Context may be raw signals, user-authored captures, distilled memory, consent grants, or external read models.
_Avoid_: Hidden prompt stuffing, unsourced memory

**Workspace Boundary**:
The user-scoped surface of Context that Nudge exposes to agents for reasoning and tool use. A workspace boundary must preserve source links, respect the current user, and keep canonical writes behind the normal Review and persistence paths.
_Avoid_: Global agent filesystem, shared memory dump, writeable canonical store

**Frame**:
A bounded question, situation, or intent Nudge is helping with. Frames define what context matters and what kind of synthesis/proposal is useful.
_Avoid_: Assuming every frame is a daily plan

**Synthesis**:
A generated interpretation over context and signals. A synthesis should be source-linked and reviewable before it changes memory or drives action.
_Avoid_: Digest as a core primitive, raw summary dump

**Proposal**:
A suggested next step, draft, memory update, or behavior change that the user can review.
_Avoid_: Action Point as a core primitive, vague recommendation

**Review**:
The Human-in-the-Loop decision over a proposal: accept, edit, reject, defer, or request more context.
_Avoid_: Notification inbox, generic task list

**Commitment**:
A user-accepted intention, action, or behavior change that Nudge should track.
_Avoid_: Silent automation

**Outcome**:
What happened after a commitment or proposal. Outcomes close the feedback loop and power evals.
_Avoid_: Unstructured feedback with no source links

**Loop Composition**:
A recurring or on-demand composition of captures, signals, context, frames, syntheses, proposals, reviews, commitments, and outcomes. The Daily Operating Loop is one composition, not the foundation itself.
_Avoid_: Baking one loop's labels into storage, APIs, or services

**Daily Operating Loop**:
A user-facing loop composition for daily orientation. It should be built from primitives rather than owning unique core concepts.
_Avoid_: Daily planning chatbot, hardcoded morning routine, generic assistant loop

**Digest**:
A user-facing label for one kind of Synthesis. Use Synthesis in core APIs and services unless referring to the specific UX surface.
_Avoid_: Treating Digest as the architectural primitive

**Wide Log**:
A single structured event for one completed unit of work, carrying enough queryable context to debug later without reconstructing state from many narrow string logs.
_Avoid_: String log line, breadcrumb spam, raw payload dump

**Action Point**:
A user-facing label for one kind of Proposal. Use Proposal in core APIs and services unless referring to the specific UX surface.
_Avoid_: Treating Action Point as the architectural primitive

**Human-in-the-Loop**:
The approval pattern for sensitive memory changes, external writes, and behavior-changing automation: the system may draft or propose, but the user confirms before activation or execution.
_Avoid_: Full autonomy, silent automation

**Consent Grant**:
A user-approved permission record that states exactly what information may be shared, for what purpose, with what redactions, and for how long.
_Avoid_: Blanket opt-in, implicit consent

**Review Queue**:
The user-facing queue where proposals wait for Review decisions.
_Avoid_: Notification inbox, generic task list

**Resume Token**:
The stored continuation context that lets an agent or workflow pause at a Review Queue decision and resume its original work after the user accepts, edits, or rejects the proposal.
_Avoid_: Callback, reminder, pending task

**Relationship Memory**:
The memory domain for people, important dates, how people know each other, relationship context, preferences, past interactions, and follow-ups.
_Avoid_: Personal CRM, contacts database

**People Graph**:
The structure underneath Relationship Memory that represents people and relationships between them.
_Avoid_: Social network, CRM pipeline
