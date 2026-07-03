# Observability and Evals

Nudge currently emits one structured wide event per HTTP request through Worker `console.log`. In local development these logs appear in `wrangler dev`; in the deployed Worker they are readable live with `wrangler tail`.

Useful commands:

```bash
bun run logs:tail
bun run logs:tail:pretty
```

The JSON tail is the agent-readable path for now. It lets an implementation agent inspect request ids, route names, status, duration, outcome, deployment environment, version, and safe error fields while debugging or improving the app. Requests also emit `traceparent` headers and forward trace metadata into Cloudflare Agent, Workflow, and Convex runtime calls so Cloudflare logs, Convex logs, and future OTLP exports can be correlated.

Current observability does not use a Nudge-owned D1 trace cache. Wrangler-managed infrastructure is limited to runtime logs/traces, product bindings, and artifact storage that product features explicitly use:

- Cloudflare Worker logs and traces are enabled in `wrangler.jsonc`.
- Convex receives trace metadata on runtime store calls and emits `convex_runtime_store_call` logs.
- Braintrust spans wrap request, route, and AI SDK work when `BRAINTRUST_API_KEY` is configured.

Current limitations:

- Agent reasoning, prompts, tool traces, and model outputs are only captured as safe summaries.
- Evals run a small deterministic golden-case suite; they are not yet wired into release gating.

Next observability step: configure an OTLP/log export destination for real agent loops. The export should include safe metadata, tool call summaries, eval case ids, outcome labels, and redacted artifacts. It must not store raw personal content, private prompts, calendar text, relationship memory content, or unredacted consent grants.

Next evals step: wire `packages/evals` into CI and deployment checks for agent workflow changes.
