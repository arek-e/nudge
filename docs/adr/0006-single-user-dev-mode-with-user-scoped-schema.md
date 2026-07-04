# Single-User Dev Mode With User-Scoped Schema

Nudge keeps a single-user local/dev fallback to keep development simple, but every durable table includes `user_id`. Deployed private usage uses Clerk, and the schema must not assume there is only one user even when local development does.
