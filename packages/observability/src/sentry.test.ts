import { describe, expect, test } from "bun:test";
import {
  buildNudgeSentryContext,
  redactSentryEvent,
  resolveSentryConfig,
  sentryEnabled,
  sentryTracesSampleRate,
} from "./sentry";

describe("sentry observability", () => {
  test("builds config only when a DSN is configured", () => {
    expect(resolveSentryConfig({ dsn: "", surface: "web-client" })).toBeNull();

    expect(
      resolveSentryConfig({
        dsn: " https://public@example.ingest.sentry.io/1 ",
        environment: "production",
        release: "nudge-web@1.2.3",
        surface: "web-client",
        tracesSampleRate: "0.25",
      }),
    ).toEqual({
      dsn: "https://public@example.ingest.sentry.io/1",
      environment: "production",
      release: "nudge-web@1.2.3",
      tags: {
        app: "nudge",
        surface: "web-client",
      },
      tracesSampleRate: 0.25,
    });
  });

  test("keeps tracing sample rates bounded", () => {
    expect(sentryTracesSampleRate("0.5")).toBe(0.5);
    expect(sentryTracesSampleRate("2")).toBe(1);
    expect(sentryTracesSampleRate("-1")).toBe(0);
    expect(sentryTracesSampleRate("not-a-number")).toBe(0);
    expect(sentryTracesSampleRate(undefined)).toBe(0);
  });

  test("treats an explicit false flag as disabled", () => {
    expect(sentryEnabled("false")).toBe(false);
    expect(sentryEnabled("0")).toBe(false);
    expect(sentryEnabled(false)).toBe(false);
    expect(sentryEnabled(undefined)).toBe(true);
  });

  test("redacts request and user fields before events leave the process", () => {
    const event = redactSentryEvent({
      request: {
        cookies: "session=secret",
        data: { token: "secret" },
        headers: {
          Authorization: "Bearer secret",
          "CF-Connecting-IP": "203.0.113.10",
          "Content-Type": "application/json",
        },
      },
      user: {
        email: "person@example.com",
        id: "user-1",
        ip_address: "203.0.113.10",
      },
    });

    expect(event).toEqual({
      request: {
        headers: {
          Authorization: "[redacted]",
          "CF-Connecting-IP": "[redacted]",
          "Content-Type": "application/json",
        },
      },
      user: {
        id: "user-1",
      },
    });
  });

  test("builds safe Nudge tags, context, and user correlation for Sentry", () => {
    const context = buildNudgeSentryContext({
      appSurface: "desktop",
      conversationId: "conversation-1",
      requestId: "request-1",
      routeName: "api.journal",
      runtimeSurface: "desktop-renderer",
      traceId: "trace-1",
      userId: "user-1",
      workflowId: "workflow-1",
      workspaceId: "workspace-1",
    });

    expect(context).toEqual({
      contexts: {
        nudge: {
          appSurface: "desktop",
          conversationId: "conversation-1",
          requestId: "request-1",
          routeName: "api.journal",
          runtimeSurface: "desktop-renderer",
          traceId: "trace-1",
          userId: "user-1",
          workflowId: "workflow-1",
          workspaceId: "workspace-1",
        },
      },
      tags: {
        app_surface: "desktop",
        route_name: "api.journal",
        runtime_surface: "desktop-renderer",
      },
      user: {
        id: "user-1",
      },
    });
  });
});
