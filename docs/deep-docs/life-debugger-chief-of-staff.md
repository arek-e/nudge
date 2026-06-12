# Life Debugger + Chief Of Staff

Date: 2026-06-11

## Product Thesis

Build an adaptive personal runtime that helps the user understand and steer their life across work, projects, obligations, health, relationships, and attention.

Not a generic AI coach.

Not just a chatbot with memory.

The product is a system that observes signals, remembers what matters, detects patterns, proposes interventions, helps execute, and evaluates whether life actually improved.

Core loop:

```txt
observe -> remember -> model -> suggest -> act -> evaluate -> evolve
```

## Two Product Modes

### Life Debugger

Purpose: diagnose patterns in the user's life.

Questions it should answer:

- Why am I repeatedly blocked?
- What drains focus?
- Which goals are stalling?
- What do I keep saying is important but not acting on?
- What commitments are quietly accumulating?
- Which routines actually improve my week?
- What changed since things were working better?

Behavior:

- notices repeated failure modes
- surfaces causal hypotheses
- proposes small experiments
- tracks whether interventions helped
- turns successful interventions into procedural memory

### Chief Of Staff

Purpose: coordinate work and commitments.

Questions it should answer:

- What needs my attention today?
- What changed since yesterday?
- Who am I waiting on?
- Who is waiting on me?
- What should I prepare for?
- Which meetings/emails/tasks relate to my active goals?
- What should be delegated, deferred, or deleted?

Behavior:

- produces daily briefs
- tracks commitments
- drafts replies and follow-ups
- prepares meeting context
- protects focus blocks
- converts loose intent into next actions

## Integration Domains

### Calendar

Signals:

- meetings
- focus blocks
- deadlines
- recurring commitments
- travel/time zones
- event attendance patterns

Useful outputs:

- daily brief
- meeting prep
- conflict detection
- schedule repair
- energy-aware planning

### Gmail / Email

Signals:

- inbound requests
- waiting-for threads
- unanswered commitments
- newsletters/research sources
- receipts/subscriptions
- emotional or urgent language

Useful outputs:

- triage
- follow-up reminders
- draft replies
- commitment extraction
- relationship/context memory

### GitHub

Signals:

- issues
- PRs
- reviews requested
- project activity
- commits
- CI failures
- release work

Useful outputs:

- engineering daily brief
- stale PR detection
- review queue
- project progress memory
- codebase convention memory

### Notes / Docs

Signals:

- research notes
- decisions
- plans
- deep docs
- drafts
- meeting notes

Useful outputs:

- knowledge graph
- decision recall
- research synthesis
- stale-plan detection
- PRD/issues generation

### Messaging

Potential sources:

- Slack
- Discord
- Telegram
- WhatsApp
- Signal, if feasible

Signals:

- commitments
- questions
- social context
- unresolved conversations
- urgency

Useful outputs:

- conversation reminders
- social follow-ups
- project context

### Health / Attention

Potential sources:

- Apple Health
- sleep data
- screen time
- focus mode
- manual check-ins

Signals:

- sleep quality
- energy
- exercise
- late-night work
- distraction patterns

Useful outputs:

- life debugging hypotheses
- routine recommendations
- energy-aware scheduling

### Browser / Reading

Potential sources:

- bookmarks
- read-it-later
- browser history, only with explicit consent
- RSS

Signals:

- research interests
- procrastination patterns
- repeated topics
- sources to summarize

Useful outputs:

- research digest
- distraction detection
- topic maps

## Memory Model For This Product

### Private Personal Memory

Facts about the user's life, relationships, preferences, constraints, and commitments.

Examples:

- user prefers mobile SSH supervision for agents
- user is exploring Cloudflare Agents and Effect TS
- user has a recurring pattern of tool setup derailing project starts

Rules:

- always source-linked
- user-correctable
- sensitive by default
- never converted to global skill knowledge without explicit approval

### Commitment Memory

Promises, obligations, waiting-for items, and deadlines.

Examples:

- reply to X
- review Y PR
- prepare for meeting Z
- follow up after no response

Rules:

- must have owner, due/expected date, source, and status
- should be rechecked by scheduled jobs
- should support snooze/defer/delete

### Pattern Memory

Recurring observations and hypotheses.

Examples:

- late-night coding correlates with missed morning planning
- research expands when no explicit output artifact is defined
- auth/tooling friction blocks project momentum

Rules:

- confidence changes over time
- should be phrased as hypothesis until validated
- must track supporting and contradicting events

### Procedural Memory

Reusable routines.

Examples:

- morning brief routine
- weekly review routine
- inbox triage routine
- project kickoff routine
- blocker triage routine

Rules:

- versioned
- evaluated
- retired if low value

### Relationship Memory

Context about people and organizations.

Examples:

- who someone is
- what projects connect us
- communication preferences
- unresolved threads

Rules:

- high sensitivity
- minimal necessary detail
- visible to user
- easy deletion

## Privacy And Trust Boundaries

This product will touch highly sensitive data. Trust is a core feature, not an implementation detail.

Rules:

- explicit opt-in per integration
- least-privilege OAuth scopes
- source every memory
- user can inspect and delete memories
- separate raw events from distilled memory
- never silently send private data to unrelated tools
- redact by default in logs
- keep integration sync jobs auditable
- allow per-source memory disablement
- make proactive actions draft-first before sending externally

Destructive/external actions should require approval:

- sending emails
- modifying calendar events
- creating public GitHub issues/PR comments
- deleting memories from raw audit history
- contacting people

## MVP Wedge

Start with the smallest loop that proves the product thesis.

### Phase 1: Manual Check-In + Calendar + GitHub

Inputs:

- manual morning/evening check-ins
- Google Calendar read-only
- GitHub read-only

Outputs:

- morning brief
- evening reflection
- commitment list
- project focus recommendation
- repeated-blocker detection

Why this wedge:

- avoids Gmail privacy complexity at first
- still gives real Chief of Staff value
- creates daily memory data
- exercises cron and durable agent sessions
- connects directly to current project work

### Phase 2: Gmail Read-Only

Add:

- inbox triage
- commitment extraction
- waiting-for detection
- follow-up reminders
- meeting prep from related emails

Keep sending replies as draft-only.

### Phase 3: Notes And Deep Docs

Add:

- research memory
- decision memory
- project knowledge graph
- stale-plan detection
- PRD/issues generation

### Phase 4: Proactive Automations

Add:

- draft emails
- draft calendar repairs
- create GitHub issues
- create recurring personal routines
- propose agent skill updates

All external actions stay approval-gated.

## Cloudflare Fit

Cloudflare is a good platform for this because:

- Agents SDK gives durable identity/session behavior
- Workers cron fits scheduled briefs/reviews
- D1 fits auditable relational memory
- Queues fit background sync and evaluation
- Vectorize can support semantic retrieval later
- Durable Objects can isolate per-user agent state
- Workers AI can bootstrap model calls

## Differentiation

Most tools are one of these:

- calendar assistant
- email assistant
- habit tracker
- notes app
- chatbot with memory
- task manager

This project is different if it becomes the connective tissue:

```txt
personal signals -> structured memory -> daily operating decisions -> evaluated behavior change
```

The hard part is not integrations alone. The hard part is turning integrations into a trustworthy evolving model of the user's life.

## Product Name Candidates

- Life Debugger
- Personal Runtime
- Chief Memory Officer
- Second Loop
- Operating Self
- Day Kernel
- Lares

The product name is now Lares. The original repo name `personal-agent-os` still describes the category, but Lares is the product brand.
