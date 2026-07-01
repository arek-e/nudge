# Effect Database Port With Drizzle Adapters

Vesta accesses durable data through an Effect `Db` service rather than importing provider-specific database clients in application code. The first adapter uses Drizzle ORM with Cloudflare D1, while future adapters such as PlanetScale, Turso, or Postgres can provide the same service contract. Drizzle schemas and migrations live in the database package, but Hono routes, workflows, agents, and domain services depend on the Effect service interface instead of D1-specific APIs.
