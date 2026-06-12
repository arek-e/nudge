# Cloudflare Agent State Boundary

Personal Agent OS uses Cloudflare Agents SDK and Durable Objects for live per-user agent/session coordination, including active conversations, pending Review Queue waits, and Resume Token wakeups. D1 remains the durable source of truth for events, memories, Review Queue items, decisions, evaluations, and workflow outcomes, while Workers Workflows handle long-running multi-step jobs such as Digest generation, calendar sync, memory consolidation, and Human-in-the-Loop pause/resume.
