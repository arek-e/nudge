# Daily Digest Workflow

Type: AFK

## Parent

`docs/prd/daily-operating-loop-mvp.md`

## What to build

Implement the first Workers Workflow for the Daily Digest. The workflow should gather recent manual signals, build a compact Digest with source-linked Action Points, and write requested/generated events so the loop is auditable.

## Acceptance criteria

- [ ] `POST /api/digests/daily/run` starts the Daily Digest workflow for the current user.
- [ ] Starting the workflow writes a `daily_digest_requested` event.
- [ ] Completing the workflow writes a `daily_digest_generated` event with Digest sections, Action Points, source event ids, and generated metadata.
- [ ] The initial Digest can be deterministic or model-backed behind a ModelService seam, but tests can run without live model access.
- [ ] `GET /api/digests/daily/latest` returns the latest generated Digest for the current user.
- [ ] Tests cover workflow trigger, source selection, generated event shape, latest Digest retrieval, and failure behavior.

## Blocked by

- `0003-manual-check-ins.md`
