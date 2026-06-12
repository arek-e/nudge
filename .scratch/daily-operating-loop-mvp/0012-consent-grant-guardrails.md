# Consent Grant Guardrails

Type: AFK

## Parent

`docs/prd/daily-operating-loop-mvp.md`

## What to build

Add the early Consent Grant schema and enforcement guardrails. The full Privacy and Consent Grants UI is not required yet, but no sharing or shared/global eval path should execute without a valid, revocable Consent Grant.

## Acceptance criteria

- [ ] Consent Grant records specify content scope, purpose, redactions, duration, status, and revocation metadata.
- [ ] A service can check whether a requested sharing/global-eval use has a valid grant.
- [ ] A simple endpoint or development/admin surface can revoke a grant.
- [ ] Any shared/global eval path introduced by this slice is blocked when no valid grant exists.
- [ ] Consent Grant Review Queue items can be represented as typed `consent_grant` items, even if the full privacy UI is deferred.
- [ ] Tests cover grant creation, expiration, revocation, enforcement failure without grant, and user scoping.

## Blocked by

- `0006-review-queue-foundation.md`
