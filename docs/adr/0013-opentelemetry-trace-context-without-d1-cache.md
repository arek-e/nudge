# OpenTelemetry Trace Context Without D1 Cache

Nudge will use OpenTelemetry-shaped trace context as the foundation for request, agent, workflow, and evaluation correlation. Cloudflare Workers native traces and logs should be enabled and exported to an OTLP destination when one exists. Nudge will not maintain its own D1 trace cache in the runtime.

evlog is the maintained wide-event layer for request context accumulation, redaction, sampling policy, structured errors, and future log drains. It is not the primary trace tree model. Wide events remain useful for request completion records, safe error fields, and operational summaries. Trace trees need `trace_id`, `span_id`, `parent_span_id`, status, timing, and attributes as first-class fields.

The first implementation slice emits one structured wide event per HTTP request, sets `x-request-id`, continues or creates W3C `traceparent`, and forwards trace metadata into Cloudflare Agent, Workflow, and Convex runtime calls. Future infrastructure can export native Worker logs/traces to an OTLP collector for ClickHouse, Grafana, Tempo, or another observability store.

The observability package should avoid becoming a "wicked feature": no helper should know about Hono, evlog, product routes, storage, and export SQL all at once. Package-level seams should be small and reusable: finalize a wide event, create OTel-compatible identifiers, parse and format `traceparent`, wrap Braintrust tracing, and record metrics. Runtime adapters such as Hono middleware are responsible for binding those pure seams to Worker-specific APIs.

D1 is not an observability store for Nudge. R2 is not the primary trace store either: use it only for redacted artifacts, eval attachments, or Logpush/archive data where object storage is appropriate. For production observability, prefer Cloudflare Workers native tracing/logging and OTLP export to an observability destination. Use Workers Analytics Engine for custom aggregate analytics, not per-span trace trees.

Implementation rules:

- Express observability read/write operations as Effects and run them at the Worker or route boundary.
- Use evlog for wide-event accumulation, but do not add a Nudge-owned trace persistence cache.
- Enable Cloudflare Workers native `observability.traces` and `observability.logs`; configure OTLP destinations in Cloudflare when one exists.
- Use OTel-compatible `traceparent`, 32-character hex trace IDs, 16-character hex span IDs, span kinds, status, timing, and semantic attribute names.
- Continue valid inbound `traceparent` headers instead of always starting unrelated traces.
- Do not expose a product `/api/traces/recent` route until it reads from a real observability destination.
- Do not store raw personal payloads, prompts, calendar text, relationship memory, or unredacted consent data in span attributes.
- Enable OTLP export only when explicit endpoint/header environment variables are present.
