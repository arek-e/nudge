# Digest Golden Cases

Type: AFK

## Parent

`docs/prd/daily-operating-loop-mvp.md`

## What to build

Add golden-case evaluation for the Daily Digest Skill. The system should support manually authored golden cases and system-proposed cases from user corrections or failures, with Review Queue approval before proposed cases become active evals.

## Acceptance criteria

- [ ] Golden case tables exist for inputs, expected constraints, source evidence, privacy scope, status, and failure modes.
- [ ] Golden case result records can compare an active Daily Digest Skill version with a proposed version.
- [ ] Manually authored golden cases can be stored and run locally.
- [ ] System-proposed golden cases are created from corrections, rejections, or failures as Review Queue items.
- [ ] Accepted proposed golden cases become active evals; rejected ones do not run.
- [ ] Tests cover manual cases, proposed cases, Review Queue approval, result comparison, and user scoping.

## Blocked by

- `0005-digest-feedback.md`
- `0006-review-queue-foundation.md`
