# Lares

Lares is an adaptive operating layer for personal work, relationships, memory, and daily decision-making. This glossary keeps product language stable across docs, planning, and implementation.

## Language

**Primitive**:
A general building block that can be composed into many user-facing loops without locking Lares into one niche workflow.
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

**Frame**:
A bounded question, situation, or intent Lares is helping with. Frames define what context matters and what kind of synthesis/proposal is useful.
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
A user-accepted intention, action, or behavior change that Lares should track.
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
