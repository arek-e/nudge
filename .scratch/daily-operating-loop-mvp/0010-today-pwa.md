# Today PWA

Type: AFK

## Parent

`docs/prd/daily-operating-loop-mvp.md`

## What to build

Build the first Worker-served PWA surface for the Daily Operating Loop. The user should be able to submit a check-in, trigger or view the latest Digest, review Action Points, give feedback, and inspect pending Review Queue items from desktop or mobile web.

## Acceptance criteria

- [ ] The PWA is served from the same Cloudflare Worker app.
- [ ] The Today view supports manual check-in capture.
- [ ] The Today view can trigger or display the latest Daily Digest.
- [ ] The Today view displays Action Points with source rationale.
- [ ] The user can submit Digest and Action Point feedback from the UI.
- [ ] The Review Queue view lists pending items and supports accept/edit/reject for supported item types.
- [ ] The UI distinguishes facts, hypotheses, suggestions, and actions.
- [ ] The UI works on desktop and mobile widths.

## Blocked by

- `0005-digest-feedback.md`
- `0006-review-queue-foundation.md`
