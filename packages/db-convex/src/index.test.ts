import type { FunctionReference } from "convex/server";
import { describe, expect, test } from "bun:test";
import { Effect } from "effect";
import {
  withRuntimeTraceContext,
  type RuntimeTraceContext,
  type SqlInsertRow,
} from "@nudge/observability";
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
  test("propagates runtime trace metadata and records a Convex client span", async () => {
    const client = new FakeConvexClient();
    const spanRows: SqlInsertRow[] = [];
    const traceContext: RuntimeTraceContext = {
      cacheable: true,
      environment: "test",
      flags: "01",
      method: "POST",
      parentSpanId: "parent-span",
      path: "/api/events",
      recordSpan: (row) => spanRows.push(row),
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

    expect(spanRows).toHaveLength(1);
    expect(spanRows[0]?.values).toEqual([
      "0123456789abcdef0123456789abcdef",
      expect.stringMatching(/^[a-f0-9]{16}$/),
      "parent-span",
      "Convex store.ensureUser",
      "client",
      "ok",
      expect.any(String),
      expect.any(String),
      expect.any(Number),
      "nudge-web",
      "test",
      "test-version",
      "ray-1",
      "api.events",
      "POST",
      "/api/events",
      null,
      "success",
      expect.stringContaining('"db.system.name":"convex"'),
      expect.any(String),
    ]);
    expect(JSON.parse(String(spanRows[0]?.values[18]))).toMatchObject({
      "convex.operation": "ensureUser",
      "server.address": "grandiose-hamster-855.eu-west-1.convex.cloud",
      "nudge.db.provider": "convex",
    });
  });
});
