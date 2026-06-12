# Single-User Dev Mode With User-Scoped Schema

Personal Agent OS starts in single-user local/dev mode to keep the first Daily Operating Loop simple, but every durable table includes `user_id` from day one. Real authentication is required before deployed private usage, and the early schema must not assume there is only one user even if the first runtime mode does.
