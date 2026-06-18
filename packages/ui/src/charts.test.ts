import { describe, expect, test } from "bun:test";
import { buildLoopFunnelData, buildOutcomeTrendData, buildSignalCalendarData } from "./index";

describe("Lares chart data", () => {
  test("builds a seven-day signal calendar from dated events", () => {
    const data = buildSignalCalendarData(
      [
        { id: "a", occurredAt: "2026-06-18T10:00:00.000Z", payload: {}, type: "signal" },
        { id: "b", occurredAt: "2026-06-18T11:00:00.000Z", payload: {}, type: "signal" },
      ],
      new Date("2026-06-18T12:00:00.000Z"),
    );

    expect(data).toHaveLength(7);
    expect(data.at(-1)).toEqual(expect.objectContaining({ count: 2, isToday: true }));
  });

  test("builds loop funnel counts in operating-loop order", () => {
    expect(
      buildLoopFunnelData({
        activeCommitmentCount: 1,
        closedOutcomeCount: 3,
        pendingProposalCount: 2,
        signalCount: 5,
        synthesisCount: 1,
      }).map((item) => [item.label, item.value]),
    ).toEqual([
      ["Signals", 5],
      ["Insights", 1],
      ["Review", 2],
      ["Commit", 1],
      ["Closed", 3],
    ]);
  });

  test("builds outcome trend counts by day", () => {
    const data = buildOutcomeTrendData([
      { id: "a", recordedAt: "2026-06-17T10:00:00.000Z", result: "completed" },
      { id: "b", recordedAt: "2026-06-17T11:00:00.000Z", result: "abandoned" },
    ]);

    expect(data).toContainEqual({ abandoned: 1, completed: 1, label: "Jun 17" });
  });
});
