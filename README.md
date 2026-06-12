# Personal Agent OS

Research-first project for exploring self-improving AI agents on Cloudflare.

Initial direction:

- Cloudflare Agents SDK for durable agent sessions.
- Hono for the HTTP API.
- Effect TS for services, workflows, errors, retries, and dependency injection.
- D1 for structured history, memories, skills, evaluations, and harness versions.
- Workers cron for daily and weekly reflection loops.
- Later: Vectorize, Cloudflare Sandbox, Browser tools, and MCP integrations.

The goal is not just a personal improvement app. The goal is an adaptive personal operating layer: a deployed runtime where the agent connects the systems the user already uses, remembers what matters, shows what changed, helps decide what matters now, supports action, and gets better through evaluated memory, skill, and harness evolution.

## Docs

- `docs/deep-docs/` is the living research/design folder.
- Add detailed notes there before turning ideas into implementation.
- Keep high-level README decisions short and link to deep docs.
