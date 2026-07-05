import { describe, expect, test } from "bun:test";
import {
  dailyNoteExtractionPrompt,
  loopIntakeSystemPrompt,
  loopReplyPrompt,
} from "./agent-prompts";

describe("agent prompts", () => {
  test("guides agents to use OKF context and reviewable writes", () => {
    expect(loopIntakeSystemPrompt).toContain("/workspace/okf");
    expect(loopIntakeSystemPrompt).toContain("okf_search");
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
    expect(prompt).toContain("Return only a valid JSON object");
    expect(prompt).toContain('"items"');
    expect(prompt).toContain("2026-06-30");
    expect(prompt).toContain("Follow up with Maya");
  });

  test("builds loop reply prompts from draft and memory context", () => {
    const prompt = loopReplyPrompt({
      draft: {
        body: "Follow up with Maya about launch notes.",
        kind: "follow_up",
        rationale: "Grounded in the user's message.",
        title: "Follow up with Maya",
      },
      fallbackReply: "Captured.",
      memoryResults: [{ text: "Maya owns launch copy." }],
      message: "Remind me what to do next.",
      user: {
        displayName: "Alex",
        id: "user_123",
      },
    });

    expect(prompt).toContain("Maya owns launch copy");
    expect(prompt).toContain("Draft title: Follow up with Maya");
    expect(prompt).toContain("Do not claim external side effects were completed");
  });
});
