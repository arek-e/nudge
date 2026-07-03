# Effect Database Port With Drizzle Adapters

Nudge accesses durable data through an Effect `Db` service rather than importing provider-specific database clients in application code. The first adapter used Drizzle ORM with Cloudflare D1, but ADR 0016 supersedes D1 as the canonical product store with a Convex-backed adapter at the same seam. Drizzle schemas and migrations may remain for local/legacy and trace-adjacent use, but Hono routes, workflows, agents, and domain modules depend on the Effect service interface instead of D1-, Drizzle-, or Convex-specific APIs.
