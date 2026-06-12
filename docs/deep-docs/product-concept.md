# Product Concept

Date: 2026-06-11

## Working Frame

The product is an adaptive personal operating layer.

It connects the systems the user already uses, turns activity into structured memory, helps decide what matters, supports action, and learns which interventions actually improve the user's life and work.

The product is not one narrow persona like "chief of staff" or "life debugger". Those are useful modes, but the broader concept is a personal system that helps the user operate better over time.

Core loop:

```txt
signals -> memory -> understanding -> decision -> action -> feedback -> adaptation
```

## Product Promise

The user should feel:

- I do not have to re-explain my context.
- I can see what is quietly accumulating.
- I know what matters today.
- I understand my recurring patterns.
- I can turn chaos into next actions.
- My tools feel connected by memory.
- The system gets more useful because it learns from outcomes, not because it flatters me.

## Core Product Jobs

### 1. Remember What Matters

Capture stable context from daily work and life.

Examples:

- goals
- projects
- commitments
- preferences
- people
- decisions
- recurring blockers
- routines that work
- routines that fail

This is the memory OS layer.

### 2. Show What Changed

Convert noisy activity into meaningful diffs.

Examples:

- what changed since yesterday
- what became urgent
- what is stale
- what is newly blocked
- what commitment appeared in email/calendar/GitHub
- what plan no longer matches reality

This is the situational awareness layer.

### 3. Decide What Matters Now

Help prioritize based on goals, commitments, energy, deadlines, and recent context.

Examples:

- today's focus
- what to ignore
- what to follow up on
- what to prepare for
- what to defer
- what to turn into a project

This is the operating rhythm layer.

### 4. Detect Patterns

Find repeated causes, loops, bottlenecks, and life/work bugs.

Examples:

- auth/tooling setup repeatedly derails project starts
- research expands without output constraints
- late-night work hurts next-day planning
- a recurring meeting creates downstream tasks
- certain kinds of tasks are repeatedly avoided

This is the life/work debugging layer.

### 5. Help Act

Turn understanding into drafts, plans, issues, schedules, reminders, and routines.

Examples:

- draft email reply
- prepare meeting brief
- create GitHub issue
- generate PRD
- produce daily plan
- propose calendar repair
- create a new personal routine

This is the execution support layer.

### 6. Learn From Outcomes

Evaluate whether suggestions and routines actually helped.

Examples:

- user rated recommendation useful
- plan completed or abandoned
- memory was corrected
- reminder was ignored
- intervention reduced repeated blocker
- routine improved weekly outcome

This is the self-improvement layer.

## Product Modes

Modes are ways the same underlying system shows up.

### Daily Operator

Morning brief, today plan, what changed, commitments, suggested focus.

### Reflection Partner

Evening review, weekly review, pattern discovery, goal progress.

### Research Partner

Paper/repo exploration, concept maps, deep docs, evolving research agenda.

### Project Copilot

GitHub/project state, PRDs, issues, codebase memory, implementation planning.

### Relationship/Commitment Tracker

People, waiting-for items, promised follow-ups, meeting context.

### Automation Scout

Notices repeated manual workflows and proposes safe automations or reusable skills.

### Personal Analyst

Looks across time and domains to surface correlations, bottlenecks, and drift.

## Integration Philosophy

Integrations are not the product. They are signal sources and action surfaces.

Each integration should answer:

1. What signals does this source provide?
2. What memories can be safely derived?
3. What user decisions does it improve?
4. What actions can be drafted?
5. What actions require approval?
6. What data should never leave this boundary?

## Integration Expansion Path

### First Sources

- manual check-ins
- GitHub
- calendar
- project docs/deep-docs

### Next Sources

- Gmail
- notes
- tasks/reminders
- browser/research feeds

### Later Sources

- messaging
- health/attention signals
- finance/subscriptions
- location/travel
- smart home/contextual environment

## Design Principles

### Memory Before Chat

The differentiator is not the chat interface. The differentiator is structured, inspectable, correctable memory.

### Draft Before Act

External actions should be drafted first and require approval until the user explicitly grants narrow autonomy.

### Source Everything

Every memory should point back to evidence.

### Separate Facts, Hypotheses, And Suggestions

The system should clearly distinguish:

- what happened
- what it believes
- what it suspects
- what it recommends

### Prefer Small Experiments

Behavior change should come from small evaluated interventions, not grand advice.

### User Owns The Model

The user can inspect, correct, delete, and export memory.

### Private By Default

Personal memory should not become shared skill knowledge unless explicitly approved.

## What This Is Not

- not a generic chatbot
- not just a task manager
- not just a calendar assistant
- not just an email triage tool
- not just a habit tracker
- not an autonomous employee that acts without trust
- not a quantified-self dashboard with no action loop

## What It Could Become

A personal adaptive runtime:

- memory layer across all tools
- daily operating system
- research and project continuity engine
- commitment and relationship context layer
- personal pattern detector
- safe automation generator
- self-improving library of routines and skills

## MVP Definition

The MVP should prove three things:

1. It remembers useful context better than a normal assistant.
2. It turns signals into decisions the user actually trusts.
3. It learns from feedback and improves one recurring workflow.

Recommended MVP:

```txt
Daily Operator + Project Copilot + Memory OS
```

Initial inputs:

- manual check-ins
- GitHub read-only
- calendar read-only
- deep-docs/project notes

Initial outputs:

- daily brief
- today focus recommendation
- commitment list
- project status summary
- evening reflection
- proposed memories
- proposed routines/skills

## Life Domains

The product should support more than work/project execution. Important domains include training, career, remembering stuff, economy/personal finance, schedule/calendar, goals, journaling, relationships, health/energy, and projects.

See `life-domains.md` for the domain map.

Initial self-improvement:

- track whether daily briefs were useful
- track which memories were corrected
- track repeated blockers
- evolve the daily brief routine

## UI And Surfaces

The main UI should be a memory/graph workspace, not just chat. Chat is an input surface. The core trust surface is linked memory: notes, goals, commitments, routines, people, projects, decisions, and patterns connected as a graph.

See `ui-and-surfaces.md`.

## Current Name

The product name is now Lares. The original `personal-agent-os` repo name described the category, but Lares better captures the private, protective, household-guardian posture of the product.

Potential product names can come later.
