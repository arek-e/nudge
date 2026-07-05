import type { FunctionReference } from "convex/server";
import { describe, expect, test } from "bun:test";
import { Effect } from "effect";
import { withRuntimeTraceContext, type RuntimeTraceContext } from "@nudge/observability";
import { makeConvexDbService, type ConvexClient, type ConvexDbStoreApi } from "./index";

type PublicMutation = FunctionReference<"mutation", "public">;
type PublicQuery = FunctionReference<"query", "public">;

const mutationReference = (name: string) => ({ _name: name }) as PublicMutation;
const queryReference = (name: string) => ({ _name: name }) as PublicQuery;

class FakeConvexClient implements ConvexClient {
  readonly mutations: Array<{ readonly args: unknown; readonly reference: PublicMutation }> = [];
  readonly queries: Array<{ readonly args: unknown; readonly reference: PublicQuery }> = [];

  async mutation<A>(reference: PublicMutation, args: unknown) {
    this.mutations.push({ args, reference });
    return undefined as A;
  }

  async query<A>(reference: PublicQuery, args: unknown) {
    this.queries.push({ args, reference });
    return undefined as A;
  }
}

const store = new Proxy(
  {},
  {
    get: (_target, property) =>
      String(property).startsWith("list") ||
      String(property).startsWith("get") ||
      String(property).startsWith("export")
        ? queryReference(`store:${String(property)}`)
        : mutationReference(`store:${String(property)}`),
  },
) as ConvexDbStoreApi;

describe("Convex DB adapter observability", () => {
  test("propagates runtime trace metadata to Convex calls", async () => {
    const client = new FakeConvexClient();
    const traceContext: RuntimeTraceContext = {
      environment: "test",
      flags: "01",
      method: "POST",
      parentSpanId: "parent-span",
      path: "/api/events",
      requestId: "ray-1",
      rootSpanId: "root-span",
      routeName: "api.events",
      service: "nudge-web",
      traceId: "0123456789abcdef0123456789abcdef",
      version: "test-version",
    };
    const db = makeConvexDbService({
      client,
      runtimeSecret: "runtime-secret",
      store,
      url: "https://grandiose-hamster-855.eu-west-1.convex.cloud",
    });

    await Effect.runPromise(
      withRuntimeTraceContext(
        db.ensureUser({ displayName: "Test User", id: "user-1" }),
        traceContext,
      ),
    );

    expect(client.mutations[0]?.args).toEqual({
      user: {
        displayName: "Test User",
        id: "user-1",
        runtimeSecret: "runtime-secret",
        trace: {
          environment: "test",
          flags: "01",
          operation: "ensureUser",
          parentSpanId: "parent-span",
          requestId: "ray-1",
          routeName: "api.events",
          service: "nudge-web",
          spanId: expect.stringMatching(/^[a-f0-9]{16}$/),
          traceId: "0123456789abcdef0123456789abcdef",
          traceparent: expect.stringMatching(
            /^00-0123456789abcdef0123456789abcdef-[a-f0-9]{16}-01$/,
          ),
          version: "test-version",
        },
      },
    });
  });

  test("updates daily note agent projection status by mutation key", async () => {
    const client = new FakeConvexClient();
    const db = makeConvexDbService({
      client,
      runtimeSecret: "runtime-secret",
      store,
      url: "https://grandiose-hamster-855.eu-west-1.convex.cloud",
    });

    await Effect.runPromise(
      db.setDailyNoteAgentStatus({
        idempotencyKey: "mutation-a",
        localDate: "2026-07-05",
        status: "ready",
        userId: "user-1",
      }),
    );

    expect(client.mutations[0]?.reference).toEqual(
      mutationReference("store:setDailyNoteAgentStatus"),
    );
    expect(client.mutations[0]?.args).toEqual({
      idempotencyKey: "mutation-a",
      localDate: "2026-07-05",
      status: "ready",
      user: {
        displayName: "user-1",
        id: "user-1",
        runtimeSecret: "runtime-secret",
      },
    });
  });
});
