# UI And Surfaces

Date: 2026-06-11

## Product UI Thesis

The main UI should not look like a normal chatbot.

It should feel like a living map of the user's context:

- memories
- notes
- goals
- commitments
- routines
- people
- projects
- events
- decisions
- patterns

The chat/input surface is for capture and conversation. The core UI is for seeing, correcting, connecting, and acting on memory.

## Inspiration

### Link Your Thinking

Useful idea: the user should see how ideas, commitments, goals, and memories connect.

### Obsidian Graph / Linked Notes

Useful idea: notes are not isolated documents. They form a graph.

For this product, graph nodes are not only notes. They include memory and action objects.

## Core UI Objects

### Node Types

- memory
- event
- goal
- commitment
- routine
- person
- project
- note
- decision
- pattern
- integration source
- evaluation

### Edge Types

- supports
- contradicts
- caused_by
- blocks
- depends_on
- part_of
- relates_to
- came_from
- supersedes
- scheduled_for
- owned_by
- waiting_for
- helped
- hurt

## Main Views

### Today View

Purpose: daily operating surface.

Shows:

- today's focus
- calendar commitments
- waiting-for items
- active goals
- relevant memories
- suggested next actions
- unresolved blockers

### Memory Inbox

Purpose: trust and correction.

Shows proposed memories before they become active.

Actions:

- accept
- edit
- reject
- mark sensitive
- set expiry
- link to goal/project/person

### Graph View

Purpose: understand context relationships.

Shows connected nodes and edges with filters.

Useful filters:

- by domain: training, career, finance, schedule, goals, journal, project
- by node type
- by confidence
- by source
- by recency
- by sensitivity

### Timeline / Journal View

Purpose: narrative continuity.

Shows:

- check-ins
- journal entries
- important events
- decisions
- memory changes
- daily/weekly summaries

### Goal View

Purpose: progress and alignment.

Shows:

- goal hierarchy
- linked routines
- blockers
- recent evidence
- next actions
- progress trend

### Commitment View

Purpose: chief-of-staff style tracking without overfitting the product identity.

Shows:

- promised by me
- promised by others
- waiting-for
- due soon
- stale
- source thread/event

### Pattern View

Purpose: life/work debugging.

Shows hypotheses and evidence.

Examples:

- repeated blocker
- correlation
- recurring schedule failure
- goal drift
- finance stressor
- training consistency issue

## Interaction Model

The user should be able to:

- capture quickly
- inspect memory
- correct memory
- connect nodes manually
- ask why something was recommended
- see source evidence
- approve or reject proposed actions
- promote a repeated action into a routine
- retire stale memories

## Tech Direction

### Frontend

Good fit:

- React
- Base UI for accessible primitives
- CSS-first styling or a small design system
- graph visualization library later

Candidates for graph rendering:

- React Flow for interactive node graphs
- Cytoscape.js for larger graph exploration
- D3 for custom visual language

Recommendation: start with React Flow for MVP graph interactions, not a custom D3 graph.

### Design Language

Avoid generic SaaS dashboards.

The UI should feel like:

- notebook
- control room
- memory graph
- daily operating console

Not too corporate. Not too gamified. Trustworthy, inspectable, calm.

## Surfaces

The product should meet the user across surfaces.

### Web App / PWA

Primary control surface.

Best for:

- graph view
- memory editing
- integrations
- settings
- review sessions
- daily/weekly planning

This should be the first serious UI.

### Mobile Web / PWA

Important because the user has iPhone.

Best for:

- quick check-ins
- today view
- memory approval
- reminders
- journaling

Should work well before building native iOS.

### SMS / iMessage Surface

Good for:

- quick capture
- reminders
- daily prompts
- lightweight replies
- emergency notes to self

Not good for:

- graph exploration
- memory review
- sensitive complex workflows

### Sendblue

Pricing checked on 2026-06-11:

- free sandbox
- production AI Agent plan around $100/month per dedicated line
- inbound-first production messaging
- webhooks/callbacks
- media, typing, reactions
- full outbound requires enterprise/custom

Recommendation:

- Use Sendblue sandbox for experiments.
- Do not depend on Sendblue for MVP core value unless messaging becomes the core wedge.
- Use PWA first; add Sendblue when daily prompts/capture justify the cost.

### Email Surface

Good for:

- daily/weekly summaries
- digests
- longer reflections
- action drafts

Cheaper and simpler than iMessage for early testing.

### Telegram / WhatsApp / Discord

Potential alternatives for chat-like interaction.

Pros:

- easier bot APIs than iMessage
- cheaper than Sendblue

Cons:

- not as native to iPhone/iMessage habits
- privacy/trust varies

### Calendar Surface

The calendar is both an input and output surface.

MVP should be read-only. Later the system can draft calendar changes for approval.

## Recommended UI MVP

Build a responsive web/PWA with four tabs:

1. Today
2. Memory Inbox
3. Goals
4. Graph

Add capture from everywhere:

- quick text box
- mobile web shortcut
- calendar/GitHub sync
- later Sendblue/iMessage capture

## Why The Graph Matters

The graph is not decoration.

It is the trust surface.

It answers:

- why did the agent remember this?
- where did this belief come from?
- what goal does this relate to?
- what is blocked by this commitment?
- what pattern is supported by evidence?
- which stale memories are still influencing recommendations?

If memory is the product's core, graph inspection is how the user trusts memory.
