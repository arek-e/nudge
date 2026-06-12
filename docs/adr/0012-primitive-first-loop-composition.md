# Primitive-First Loop Composition

Lares uses general primitives as its core domain model: Capture, Signal, Context, Frame, Synthesis, Proposal, Review, Commitment, Outcome, and Loop Composition. Product surfaces such as the Daily Operating Loop, morning check-ins, digests, and action points are compositions or UX labels built from those primitives.

This prevents the architecture from hardcoding one niche workflow. A daily orientation experience, relationship preparation, travel context, weekly reflection, project decision support, or custom integration should all use the same underlying primitives rather than creating parallel feature-specific models.

Core APIs, database records, services, tests, and evals should prefer primitive language. UX copy may use friendlier labels when helpful, but those labels should map clearly back to primitives. For example, a "morning check-in" is a Capture that becomes one or more Signals; a "digest" is a Synthesis; an "action point" is a Proposal; the "review queue" is a Review surface.

Existing event storage remains valid as the first Signal store. New public routes should introduce primitive names such as `/api/captures` and `/api/signals` while keeping `/api/events` as a compatibility alias until the product has a cleaner migration path.
