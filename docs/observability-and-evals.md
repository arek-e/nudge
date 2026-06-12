# Observability and Evals

Lares currently emits one structured wide event per HTTP request through Worker `console.log`. In local development these logs appear in `wrangler dev`; in the deployed Worker they are readable live with `wrangler tail`.

Useful commands:

```bash
bun run logs:tail
bun run logs:tail:pretty
bun run traces:recent
```

The JSON tail is the agent-readable path for now. It lets an implementation agent inspect request ids, route names, status, duration, outcome, deployment environment, version, and safe error fields while debugging or improving the app.

Trace/event persistence now uses Wrangler-managed infrastructure:

- D1 table `trace_events` stores indexed safe wide-event metadata and the redacted JSON payload.
- D1 tables `agent_runs`, `eval_runs`, and `eval_case_results` are provisioned for upcoming agent/eval loops.
- R2 bucket `lares-trace-artifacts` is bound as `TRACE_ARTIFACTS` for larger redacted artifacts.

Current limitations:

- Agent reasoning, prompts, tool traces, and model outputs are not yet captured.
- Evals are scaffolded but do not yet run golden cases against agent behavior.

Next observability step: add an agent trace sink before building real agent loops. The trace sink should store safe metadata, tool call summaries, eval case ids, outcome labels, and redacted artifacts. It must not store raw personal content, private prompts, calendar text, relationship memory content, or unredacted consent grants.

Next evals step: turn `packages/evals` into a golden-case runner for the Daily Operating Loop. Each case should define user-owned input events, expected digest/action behavior, safety constraints, and scoring notes. Evals should run locally in CI before any agent workflow change is deployed.
