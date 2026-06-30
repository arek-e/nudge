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
- Daily note analysis and conversation replies write safe agent run trace summaries.
- Evals run a small deterministic golden-case suite through `bun run check`, CI, deploy gating, and the internal Worker eval route.

Internal Worker eval runs are available at `POST /__internal/evals/agent` with `x-lares-eval-secret` set to the internal agent secret. The route passes the Worker D1 and R2 bindings into `createEvalTraceSink`.

Next observability step: add a read model for recent agent and eval runs once the UI needs it.
