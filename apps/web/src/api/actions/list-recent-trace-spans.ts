import { Effect } from "effect";
import type { ApiContext } from "../context";
import type { ApiAction } from "./effect-helpers";
import { type TraceSpanRow, readRecentTraceSpans } from "../db/read-recent-trace-spans";

export interface ListRecentTraceSpansInput {
  readonly context: ApiContext;
  readonly limit?: number;
}

export interface TraceSpanSummary {
  readonly id: string;
  readonly traceId: string;
  readonly parentSpanId: string | null;
  readonly name: string;
  readonly kind: string;
  readonly status: string;
  readonly startedAt: string;
  readonly endedAt: string | null;
  readonly durationMs: number | null;
  readonly routeName: string | null;
  readonly method: string | null;
  readonly path: string | null;
}

export interface ListRecentTraceSpansResult {
  readonly spans: TraceSpanSummary[];
}

function toTraceSpanSummary(row: TraceSpanRow): TraceSpanSummary {
  return {
    id: row.id,
    traceId: row.trace_id,
    parentSpanId: row.parent_span_id,
    name: row.name,
    kind: row.kind,
    status: row.status,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationMs: row.duration_ms,
    routeName: row.route_name,
    method: row.method,
    path: row.path,
  };
}

export function listRecentTraceSpans(
  input: ListRecentTraceSpansInput,
): ApiAction<ListRecentTraceSpansResult> {
  return readRecentTraceSpans({
    limit: input.limit ?? 20,
    ...(input.context.traceDb ? { traceDb: input.context.traceDb } : {}),
  }).pipe(Effect.map((rows) => ({ spans: rows.map(toTraceSpanSummary) })));
}
