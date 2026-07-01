import { describe, expect, test } from "bun:test";
import { dailyNoteExtractionPrompt, loopIntakeSystemPrompt } from "./agent-prompts";

describe("agent prompts", () => {
  test("guides agents to use OKF context and reviewable writes", () => {
    expect(loopIntakeSystemPrompt).toContain("/workspace/okf");
    expect(loopIntakeSystemPrompt).toContain("okf_search");
    expect(loopIntakeSystemPrompt).toContain("capture_append");
    expect(loopIntakeSystemPrompt).toContain("proposal_write");
    expect(loopIntakeSystemPrompt).toContain("Do not mutate OKF files");
    expect(loopIntakeSystemPrompt).toContain("Examples");
  });

  test("keeps daily-note extraction grounded in the note", () => {
    const prompt = dailyNoteExtractionPrompt({
      changedText: "Follow up with Maya about launch notes.",
      localDate: "2026-06-30",
    });

    expect(prompt).toContain("Return only facts grounded in the note");
    expect(prompt).toContain("2026-06-30");
    expect(prompt).toContain("Follow up with Maya");
  });
});
