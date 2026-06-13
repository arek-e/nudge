import { describe, expect, test } from "bun:test";
import { deriveJourneyDayGroups, deriveLoopInsights } from ".";

describe("loop view derivations", () => {
  test("groups Journey signals by local day", () => {
    expect(
      deriveJourneyDayGroups([
        {
          id: "signal-1",
          occurredAt: "2026-06-13T10:00:00.000Z",
          payload: { note: "Morning capture" },
          source: "today_app",
          type: "manual_check_in_submitted",
        },
        {
          id: "signal-2",
          occurredAt: "2026-06-12T10:00:00.000Z",
          payload: { note: "Yesterday capture" },
          source: "today_app",
          type: "manual_check_in_submitted",
        },
      ]),
    ).toEqual([
      {
        dateLabel: "Jun 13, 2026",
        items: [
          {
            detail: "Morning capture",
            id: "signal-1",
            title: "Manual check in submitted",
          },
        ],
      },
      {
        dateLabel: "Jun 12, 2026",
        items: [
          {
            detail: "Yesterday capture",
            id: "signal-2",
            title: "Manual check in submitted",
          },
        ],
      },
    ]);
  });

  test("derives completion ratio insights from outcomes", () => {
    expect(
      deriveLoopInsights({
        activeCommitmentCount: 2,
        outcomes: [
          { id: "outcome-1", recordedAt: "2026-06-13T10:00:00.000Z", result: "completed" },
          { id: "outcome-2", recordedAt: "2026-06-13T11:00:00.000Z", result: "abandoned" },
        ],
      }),
    ).toEqual([
      {
        detail: "1 of 2 closed loops completed recently.",
        label: "Completion rate",
        value: "50%",
      },
      {
        detail: "2 commitments still need an outcome.",
        label: "Open loop load",
        value: "2",
      },
      {
        detail: "2 outcomes recorded in recent history.",
        label: "Closed loops",
        value: "2",
      },
    ]);
  });
});
