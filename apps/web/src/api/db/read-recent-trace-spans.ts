import { Effect } from "effect";

export interface TraceSpanRow {
  readonly id: string;
  readonly trace_id: string;
  readonly parent_span_id: string | null;
  readonly name: string;
  readonly kind: string;
  readonly status: string;
  readonly started_at: string;
  readonly ended_at: string | null;
  readonly duration_ms: number | null;
  readonly route_name: string | null;
  readonly method: string | null;
  readonly path: string | null;
}

export interface ReadRecentTraceSpansInput {
  readonly limit: number;
  readonly traceDb?: D1Database;
}

export type ReadRecentTraceSpansResult = TraceSpanRow[];

export function readRecentTraceSpans(
  input: ReadRecentTraceSpansInput,
): Effect.Effect<ReadRecentTraceSpansResult, unknown, never> {
  const traceDb = input.traceDb;
  if (typeof traceDb?.prepare !== "function") return Effect.succeed([]);

  return Effect.tryPromise({
    try: async () => {
      const result = await traceDb
        .prepare(
          `SELECT
            span_id AS id,
            trace_id,
            parent_span_id,
            name,
            kind,
            status,
            started_at,
            ended_at,
            duration_ms,
            route_name,
            method,
            path
          FROM trace_spans
          WHERE route_name IS NULL OR route_name != 'api.traces'
          ORDER BY started_at DESC
          LIMIT ?`,
        )
        .bind(input.limit)
        .all<TraceSpanRow>();

      return result.results ?? [];
    },
    catch: (cause) => cause,
  }).pipe(Effect.withSpan("TraceSpans.listRecent", { attributes: { limit: input.limit } }));
}
