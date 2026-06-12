# React SPA With SSE-First Agent Streaming

Lares uses a React single-page app served by the Cloudflare Worker as the first frontend architecture. The app should use TanStack Router for client routing and TanStack Query for API state. Hono and oRPC remain the backend API boundary for user-owned data, OpenAPI documentation, auth, observability, D1, Durable Objects, and Workers Workflows.

TanStack Start server functions should not be introduced yet. They would create a second server-action boundary that overlaps with the existing Worker API and complicates the product's public OpenAPI integration contract before Lares needs SSR or colocated server mutations. Revisit TanStack Start if the app needs SSR for shareable pages, SEO-sensitive public surfaces, or route-level server loading that cannot be handled cleanly by the Worker API.

For agent and chat experiences, use Server-Sent Events first for model tokens, workflow progress, and append-only agent status updates. SSE fits the first Daily Operating Loop because most early streams are server-to-client, work well through normal HTTP infrastructure, are easy to resume or replay from durable events, and keep the API contract simpler than WebSockets.

Use WebSockets later for bidirectional live agent sessions, collaborative presence, interruption/cancel controls that need low latency, voice-like experiences, or tool execution sessions where the client and agent exchange state continuously. Those WebSocket sessions should be owned by Durable Objects so per-user session state, backpressure, reconnect behavior, and Resume Tokens have one durable coordination point.
