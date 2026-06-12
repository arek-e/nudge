# OpenAPI-First Public API Contract

Lares uses OpenAPI as the first public API contract for user-owned data and custom integrations. The public HTTP API is a product surface: users should be able to inspect, script against, automate, and integrate with their own Lares data without reverse-engineering an app-internal RPC protocol.

Hono remains the Worker HTTP router because it matches the current Cloudflare architecture and keeps middleware, auth, observability, Durable Object, Workflow, and D1 binding behavior in one Worker app. However, Hono RPC should not be the primary public API contract because it optimizes for in-repo TypeScript inference rather than durable external integration contracts.

oRPC is the preferred candidate for public API implementation because it combines end-to-end TypeScript ergonomics with first-class OpenAPI support, contract-first workflows, schema validation, typed errors, and Hono/Cloudflare-compatible adapters. The next domain API slice should validate this with one small public route before Lares grows a larger API surface.

Effect RPC is a strong fit for Effect-native internal APIs: it defines schema-backed `RpcGroup`s, typed success and error channels, streaming procedures, middleware, test clients, and HTTP protocols that align with Lares' Effect service model. However, in the Effect v4 package line Lares is using, RPC is exposed under `effect/unstable/rpc`. It should not be the first public integration contract until the v4 API surface is stable and Lares has a specific need for Effect RPC's protocol, streaming, or typed error model at an internal HTTP boundary.

tRPC, GraphQL, and gRPC/Connect are not first choices for the MVP. tRPC is less suitable for third-party integrations than OpenAPI, GraphQL adds query-language and authorization complexity before Lares needs it, and gRPC/Connect is stronger for service-to-service APIs than user-authored custom integrations.

This decision does not require a large refactor today. Existing health and version routes can remain plain Hono routes. The first domain API route that exposes user-owned data should be implemented through the OpenAPI-capable API layer, and any duplicate plain Hono route should be avoided.
