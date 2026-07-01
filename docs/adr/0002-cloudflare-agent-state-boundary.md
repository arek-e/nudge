# Cloudflare Agent State Boundary

Vesta uses Cloudflare Agents SDK and Durable Objects for live per-user agent/session coordination, starting with active conversations. Pending Review Queue waits and Resume Token wakeups are future slices. D1 remains the durable source of truth for events, memories, Review Queue items, decisions, evaluations, and workflow outcomes, while Workers Workflows handle long-running multi-step jobs such as note analysis, Digest generation, memory consolidation, and Human-in-the-Loop pause/resume.
