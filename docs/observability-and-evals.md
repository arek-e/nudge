# Observability and Evals

Lares currently emits one structured wide event per HTTP request through Worker `console.log`. In local development these logs appear in `wrangler dev`; in the deployed Worker they are readable live with `wrangler tail`.

Useful commands:

```bash
bun run logs:tail
bun run logs:tail:pretty
bun run traces:recent
```

The JSON tail is the agent-readable path for now. It lets an implementation agent inspect request ids, route names, status, duration, outcome, deployment environment, version, and safe error fields while debugging or improving the app.

Trace/event persistence uses Wrangler-managed infrastructure:

- D1 table `trace_events` stores indexed safe wide-event metadata and the redacted JSON payload.
- D1 table `trace_spans` stores recent OpenTelemetry-shaped request spans for `/api/traces/recent`.
- D1 tables `agent_runs`, `eval_runs`, and `eval_case_results` store safe agent/eval run summaries.
- D1 tables `daily_agent_runs` and `daily_agent_run_outputs` track note-analysis runs and generated outputs.
- R2 bucket `lares-trace-artifacts` is bound as `TRACE_ARTIFACTS` for larger redacted artifacts.

Current limitations:

- Agent reasoning, prompts, tool traces, and model outputs are only captured as safe summaries.
- Daily note analysis writes agent run trace summaries; conversation agent replies are not yet written to `agent_runs`.
- Evals run a small deterministic golden-case suite through `bun run check`, CI, and deploy gating.

Next observability step: wire conversation agent replies into the agent trace sink.

Next evals step: run evals from a Cloudflare-bound runner that passes `createEvalTraceSink` D1 and R2 bindings.
