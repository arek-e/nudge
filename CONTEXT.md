# Personal Agent OS

Personal Agent OS is an adaptive operating layer for personal work, relationships, memory, and daily decision-making. This glossary keeps product language stable across docs, planning, and implementation.

## Language

**Daily Operating Loop**:
The primary day-to-day product loop: collect new signals, summarize what changed, recommend focus and action points, capture reflection, and learn from feedback.
_Avoid_: Daily planning chatbot, morning routine, generic assistant loop

**Digest**:
A short, skimmable summary of new or missed information that helps the user catch up quickly without reading every source directly.
_Avoid_: Feed, notification stream, raw summary dump

**Action Point**:
A concrete suggested next step derived from signals, memory, goals, commitments, or relationship context.
_Avoid_: Advice, insight, vague recommendation

**Human-in-the-Loop**:
The approval pattern for sensitive memory changes, external writes, and behavior-changing automation: the system may draft or propose, but the user confirms before activation or execution.
_Avoid_: Full autonomy, silent automation

**Consent Grant**:
A user-approved permission record that states exactly what information may be shared, for what purpose, with what redactions, and for how long.
_Avoid_: Blanket opt-in, implicit consent

**Review Queue**:
The unified approval surface where proposed memories, Action Points, external write drafts, Relationship Memory updates, and routine changes wait for Human-in-the-Loop decisions.
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
