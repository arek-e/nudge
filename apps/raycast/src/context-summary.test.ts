import { describe, expect, test } from "bun:test";
import type { SurfaceRefreshContext } from "@nudge/surface";
import { buildRaycastContextSections } from "./context-summary";

describe("Raycast current context summary", () => {
  test("summarizes the same journal, action, signal, and AI review context as iOS refresh", () => {
    const context = {
      actions: {
        actions: [
          {
            body: "Ask for a launch date and owner.",
            confidence: 0.87,
            createdAt: "2026-07-03T08:00:00.000Z",
            id: "action-1",
            kind: "follow_up",
            status: "proposed",
            title: "Follow up with Sam",
            updatedAt: "2026-07-03T08:00:00.000Z",
          },
          {
            body: "This is already closed.",
            confidence: 0.75,
            createdAt: "2026-07-02T08:00:00.000Z",
            id: "action-2",
            kind: "reminder",
            status: "completed",
            title: "Closed task",
            updatedAt: "2026-07-02T08:00:00.000Z",
          },
        ],
        latestRun: {
          id: "run-1",
          metadata: { itemCount: 3, provider: "cloudflare-think" },
          sourceId: "journal-1",
          sourceType: "journal",
          startedAt: "2026-07-03T08:01:00.000Z",
          status: "running",
          triggerType: "journal_saved",
          userId: "user-1",
        },
      },
      calendarDays: [{ localDate: "2026-07-03", noteCount: 1, signalCount: 4 }],
      journal: {
        bodyText: "Morning plan\n\nFollow up on shared engine rollout.",
        createdAt: "2026-07-03T07:00:00.000Z",
        id: "journal-1",
        localDate: "2026-07-03",
        title: "Daily note",
        updatedAt: "2026-07-03T08:00:00.000Z",
        userId: "user-1",
      },
      session: {
        authMode: "anonymous",
        user: { displayName: "Raycast install", id: "user-1" },
        workspace: { id: "workspace-1", label: "Personal" },
      },
      signals: [
        {
          createdAt: "2026-07-03T08:03:00.000Z",
          id: "signal-1",
          idempotencyKey: "raycast:1",
          occurredAt: "2026-07-03T08:03:00.000Z",
          payload: { note: "Ship the desktop shell first." },
          schemaVersion: 1,
          source: "raycast_extension",
          type: "manual_check_in_submitted",
          userId: "user-1",
        },
      ],
    } satisfies SurfaceRefreshContext;

    expect(buildRaycastContextSections(context)).toEqual([
      {
        items: [
          {
            accessories: [{ text: "2026-07-03" }],
            id: "journal",
            subtitle: "Morning plan Follow up on shared engine rollout.",
            title: "Daily note",
          },
          {
            accessories: [{ text: "1" }],
            id: "open-loops",
            subtitle: "Proposed or accepted actions",
            title: "Open loops",
          },
          {
            accessories: [{ text: "3 items" }],
            id: "latest-run",
            subtitle: "running via cloudflare-think",
            title: "AI review",
          },
        ],
        title: "Today",
      },
      {
        items: [
          {
            accessories: [{ text: "proposed" }],
            id: "action-1",
            reviewActionId: "action-1",
            subtitle: "Ask for a launch date and owner.",
            title: "Follow up with Sam",
          },
        ],
        title: "Actions",
      },
      {
        items: [
          {
            accessories: [{ text: "raycast_extension" }],
            id: "signal-1",
            subtitle: "Ship the desktop shell first.",
            title: "manual_check_in_submitted",
          },
        ],
        title: "Signals",
      },
    ]);
  });
});
