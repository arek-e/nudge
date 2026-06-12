# Digest Feedback

Type: AFK

## Parent

`docs/prd/daily-operating-loop-mvp.md`

## What to build

Capture structured feedback on each Digest, Digest section, and Action Point so the Daily Digest Skill can improve through live outcome data before any evolution is automated.

## Acceptance criteria

- [ ] Feedback tables or records exist for Digest-level, section-level, and Action Point-level feedback.
- [ ] `POST /api/digests/:id/feedback` records overall rating: `useful`, `mixed`, or `not_useful`.
- [ ] The API records per-section feedback: `keep`, `change`, or `remove`.
- [ ] The API records Action Point feedback: `accepted`, `edited`, `rejected`, or `completed_later`.
- [ ] Feedback writes a source event or durable feedback record linked to the Digest.
- [ ] Tests cover rating, editing, rejection, completion feedback, and user scoping.

## Blocked by

- `0004-daily-digest-workflow.md`
