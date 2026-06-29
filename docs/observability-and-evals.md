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
- D1 tables `agent_runs`, `eval_runs`, and `eval_case_results` are provisioned for upcoming agent/eval loops.
- D1 tables `daily_agent_runs` and `daily_agent_run_outputs` track note-analysis runs and generated outputs.
- R2 bucket `lares-trace-artifacts` is bound as `TRACE_ARTIFACTS` for larger redacted artifacts.

Current limitations:

- Agent reasoning, prompts, tool traces, and model outputs are only captured as safe summaries.
- Evals run a small deterministic golden-case suite; they are not yet wired into release gating.

Next observability step: add an agent trace sink for real agent loops. The trace sink should store safe metadata, tool call summaries, eval case ids, outcome labels, and redacted artifacts. It must not store raw personal content, private prompts, calendar text, relationship memory content, or unredacted consent grants.

Next evals step: wire `packages/evals` into CI and deployment checks for agent workflow changes.
