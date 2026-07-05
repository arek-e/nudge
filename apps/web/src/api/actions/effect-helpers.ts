import { Effect } from "effect";
import { Db } from "@nudge/db";
import { MemoryIndex } from "@nudge/effect-services";
import type { ApiContext } from "../context";

export type ApiAction<A, E = unknown> = Effect.Effect<A, E, Db>;

export interface ApiEffectResult<A> {
  readonly result: A;
  readonly wideEvent?: Record<string, unknown>;
}

export interface ApiEffectResultInput<A> {
  readonly result: A;
  readonly wideEvent?: Record<string, unknown>;
}

export function apiEffectResult<A>(input: ApiEffectResultInput<A>): ApiEffectResult<A> {
  return input.wideEvent
    ? { result: input.result, wideEvent: input.wideEvent }
    : { result: input.result };
}

export interface RunApiEffectInput<A, E> {
  readonly context: ApiContext;
  readonly effect: Effect.Effect<ApiEffectResult<A>, E, Db>;
}

export function runApiEffect<A, E>(input: RunApiEffectInput<A, E>): ApiAction<A, E> {
  return input.effect.pipe(
    Effect.tap((output) =>
      Effect.sync(() => {
        if (output.wideEvent) input.context.addWideEvent(output.wideEvent);
      }),
    ),
    Effect.map((output) => output.result),
  );
}

export interface RunWorkflowInput<A, E> {
  readonly workflow: Effect.Effect<A, E, Db>;
}

export function runWorkflow<A, E>(input: RunWorkflowInput<A, E>): ApiAction<A, E> {
  return input.workflow;
}

export interface RunMemoryIndexInput<A, E> {
  readonly turbopuffer: { readonly apiKey: string; readonly region: string };
  readonly workflow: Effect.Effect<A, E, Db | MemoryIndex>;
}

export function runMemoryIndex<A, E>(input: RunMemoryIndexInput<A, E>): ApiAction<A, E> {
  return Effect.provide(input.workflow, MemoryIndex.layerTurbopuffer(input.turbopuffer));
}

export interface RunApiActionInput<A, E> {
  readonly context: ApiContext;
  readonly effect: ApiAction<A, E>;
}

export function runApiAction<A, E>(input: RunApiActionInput<A, E>): Promise<A> {
  return input.context.runEffect(input.effect);
}

export interface RecordApiSpanInput<A, E> {
  readonly attributes?: Readonly<Record<string, unknown>>;
  readonly context: ApiContext;
  readonly effect: ApiAction<A, E>;
  readonly kind?: "client" | "internal";
  readonly name: string;
}

export function recordApiSpan<A>(input: RecordApiSpanInput<A, unknown>): ApiAction<A> {
  return Effect.tryPromise({
    try: () =>
      input.context.recordSpan(
        input.name,
        {
          ...(input.attributes !== undefined ? { attributes: input.attributes } : {}),
          ...(input.kind !== undefined ? { kind: input.kind } : {}),
        },
        () => input.context.runEffect(input.effect),
      ),
    catch: (cause) => cause,
  });
}
