# OpenTelemetry Traces With D1 Cache

Vesta will use OpenTelemetry-shaped traces as the foundation for request, agent, workflow, and evaluation timing trees. Cloudflare Workers native traces and logs should be enabled and exported to an OTLP destination when one exists. The local product/debug surface may read a bounded D1 trace cache, while future infrastructure can export the same trace model to an OTLP collector for ClickHouse, Grafana, Tempo, or another observability store.

evlog is the maintained wide-event layer for request context accumulation, redaction, sampling policy, structured errors, and future log drains. It is not the primary trace tree model. Wide events remain useful for request completion records, safe error fields, and operational summaries. Trace trees need `trace_id`, `span_id`, `parent_span_id`, status, timing, and attributes as first-class fields.

The first implementation slice persists one root server span per request into `trace_spans` and exposes safe summaries through `/api/traces/recent`. `packages/observability` owns the trace-cache read model so another Worker or App Surface can expose a compatible tracing subroute without copying SQL. Future slices should add child spans for auth, oRPC handlers, database calls, synthesis, proposal generation, workflow steps, and agent sessions.

The observability package should avoid becoming a "wicked feature": no helper should know about Hono, D1, evlog, product routes, and trace SQL all at once. Package-level seams should be small and reusable: finalize a wide event, build a trace event row, build an OpenTelemetry-shaped span row, create OTel-compatible identifiers, wrap Braintrust tracing, list safe trace summaries, and record metrics. Runtime adapters such as Hono middleware are responsible for binding those pure seams to Worker-specific APIs.

D1 is not the long-term observability store. It is a small, queryable product/debug cache for all recent safe summaries that the app and agents can inspect. Recent means bounded by retention and row caps, currently seven days, 5,000 span rows, and 1,000 wide-event rows. R2 is not the primary trace store either: use it for redacted artifacts, eval attachments, or Logpush/archive data where object storage is appropriate. For production observability, prefer Cloudflare Workers native tracing/logging and OTLP export to an observability destination. Use Workers Analytics Engine for custom aggregate analytics, not per-span trace trees.

Implementation rules:

- Express observability read/write operations as Effects and run them at the Worker or route boundary.
- Use evlog for wide-event accumulation, but keep D1 persistence and trace span construction behind Vesta-owned Effect seams.
- Enable Cloudflare Workers native `observability.traces` and `observability.logs`; configure OTLP destinations in Cloudflare when one exists.
- Use OTel-compatible `traceparent`, 32-character hex trace IDs, 16-character hex span IDs, span kinds, status, timing, and semantic attribute names.
- Continue valid inbound `traceparent` headers instead of always starting unrelated traces.
- Do not cache `/api/traces/*` spans in D1; trace inspection should not pollute the recent trace view.
- Write D1 trace cache rows in background work and prune the cache as best effort.
- Do not store raw personal payloads, prompts, calendar text, relationship memory, or unredacted consent data in span attributes.
- Keep D1 trace cache synchronous enough for product/debug UI, but design for eventual async export to avoid request-path latency.
- Enable OTLP export only when explicit endpoint/header environment variables are present.
