# Life Domains

Date: 2026-06-11

## Purpose

The product should support the user's whole operating context, not only work projects.

Important domains:

- training
- career
- memory / remembering stuff
- economy / personal finance
- schedule and calendar
- goals
- journaling
- projects
- relationships and commitments
- health and energy

The system should not treat these as separate apps. It should connect them through memory, goals, commitments, routines, and feedback.

## Domain: Training

Meaning:

- exercise
- skill practice
- learning plans
- health routines
- consistency tracking

Signals:

- planned workouts
- completed workouts
- skipped sessions
- energy level
- sleep
- injuries or constraints
- skill practice reps

Useful outputs:

- training plan for the week
- recovery-aware scheduling
- consistency nudges
- pattern detection around missed sessions
- progress summaries
- small experiments to improve adherence

Memory needed:

- preferred training style
- constraints and injuries
- recurring excuses/blockers
- what routines worked before
- current progression plan

MVP input can be manual check-ins. Integrations can come later through Apple Health or wearable exports.

## Domain: Career

Meaning:

- long-term career direction
- skill development
- portfolio/projects
- applications/opportunities
- networking
- reputation

Signals:

- GitHub activity
- project notes
- learning goals
- applications
- meetings
- conversations
- feedback received

Useful outputs:

- career strategy review
- skill gap analysis
- portfolio project suggestions
- weekly career progress summary
- networking follow-up reminders
- brag document / accomplishment log

Memory needed:

- desired roles
- current skill map
- projects completed
- proof of work
- people and organizations
- career constraints and preferences

## Domain: Remembering Stuff

Meaning:

- commitments
- facts
- preferences
- decisions
- people
- ideas
- context from conversations
- things the user said they care about

Signals:

- check-ins
- notes
- email
- calendar
- GitHub
- documents
- manual saves

Useful outputs:

- "what did I say about this?"
- "what am I forgetting?"
- decision recall
- commitment list
- context before meetings
- stale-memory review

Memory needed:

- source-linked facts
- confidence
- sensitivity
- expiry/staleness
- contradictions
- user corrections

This is the product's core substrate.

## Domain: Economy / Personal Finance

Meaning:

- spending awareness
- subscriptions
- bills
- savings goals
- income planning
- project/business finances
- financial stress patterns

Signals:

- manual expense check-ins
- bank/export data later
- email receipts
- subscriptions
- calendar bill reminders
- goals

Useful outputs:

- monthly money review
- subscription audit
- spending pattern summaries
- upcoming bill reminders
- savings goal tracking
- financial decision journal

Memory needed:

- recurring expenses
- financial goals
- spending categories
- risk tolerance
- constraints
- important financial decisions

Privacy rules:

- finance data is high sensitivity
- start manual-only or import-only
- no autonomous transactions
- no account credentials in memory

## Domain: Schedule And Calendar

Meaning:

- time commitments
- meetings
- focus blocks
- routines
- deadlines
- recovery time

Signals:

- calendar events
- manual plans
- recurring routines
- task deadlines
- energy check-ins

Useful outputs:

- daily plan
- schedule conflict detection
- meeting prep
- focus protection
- rescheduling suggestions
- what changed since yesterday

Memory needed:

- preferred work times
- recurring obligations
- energy patterns
- hard constraints
- time estimates
- schedule failure modes

## Domain: Goals

Meaning:

- long-term outcomes
- active projects
- habits
- experiments
- commitments to self

Signals:

- user-created goals
- check-ins
- calendar
- GitHub/project progress
- journal entries
- outcome ratings

Useful outputs:

- goal decomposition
- weekly progress review
- next action suggestions
- stalled goal detection
- goal conflict detection
- experiments to improve progress

Memory needed:

- goal hierarchy
- current status
- motivation/reason
- deadline
- blockers
- linked routines
- evidence of progress

## Domain: Journaling

Meaning:

- daily reflection
- emotional context
- thinking out loud
- decision logs
- gratitude/wins
- lessons learned

Signals:

- morning check-in
- evening reflection
- freeform notes
- weekly review
- voice notes later

Useful outputs:

- reflection prompts
- weekly synthesis
- mood/focus patterns
- recurring themes
- decision extraction
- memory proposals

Memory needed:

- journal entries as raw events
- extracted themes
- emotional state trends
- decisions
- lessons
- unresolved questions

Privacy rules:

- journal content is high sensitivity
- the user should choose what becomes durable memory
- private reflections should not automatically become action items

## Cross-Domain Connections

The product becomes interesting when domains influence each other.

Examples:

- Training affects energy, which affects schedule and career execution.
- Economy affects stress, which affects goals and planning.
- Calendar overload explains missed training and weak journaling.
- Journaling reveals blockers that become project actions.
- Career goals determine which GitHub projects matter.
- Remembered commitments shape the daily plan.

This means the memory model must support relationships, not isolated lists.

## Domain Model Additions

Add domain tags to memory and events:

```txt
training | career | finance | schedule | goals | journal | project | relationship | health | general
```

Add cross-domain relation types:

```txt
supports | blocks | causes | correlates_with | depends_on | conflicts_with | contributes_to
```

## Product Principle

The system should help the user operate across domains without collapsing everything into productivity advice.

It should preserve the shape of each domain:

- training needs consistency and recovery
- career needs compounding proof of work
- finance needs caution and auditability
- schedule needs constraints and tradeoffs
- goals need decomposition and review
- journaling needs privacy and reflection
- memory needs source, correction, and forgetting

## MVP Domain Scope

Start with domains that can work without sensitive integrations:

- goals
- journaling
- schedule/calendar read-only
- projects/GitHub read-only
- remembering commitments

Add next:

- training via manual check-ins
- career via project/accomplishment memory
- finance via manual monthly review

Add later with stronger privacy controls:

- Gmail
- finance imports
- health/wearable integrations
- messaging
