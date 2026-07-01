# Single-User Dev Mode With User-Scoped Schema

Vesta keeps a single-user local/dev fallback to keep development simple, but every durable table includes `user_id`. Deployed private usage uses Better Auth when configured, and the schema must not assume there is only one user even when local development does.
