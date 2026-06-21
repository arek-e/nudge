import { describe, expect, test } from "bun:test";
import { runAgentEvalSuite } from "./index";

describe("agent evals", () => {
  test("scores journal-to-action quality over golden cases", async () => {
    const report = await runAgentEvalSuite();

    expect(report.passed).toBe(true);
    expect(report.score).toBe(1);
    expect(report.results).toEqual([
      expect.objectContaining({
        caseId: "journal-follow-up-maya-travel",
        passed: true,
        score: 1,
      }),
      expect.objectContaining({
        caseId: "journal-capture-more-context",
        passed: true,
        score: 1,
      }),
    ]);
  });
});
