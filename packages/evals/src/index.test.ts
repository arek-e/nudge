import { describe, expect, test } from "bun:test";
import {
  agentEvalCases,
  createCodexCliJudge,
  createHttpAgentRunner,
  renderCodexEvalReport,
  runAgentEvalSuite,
  type AgentEvalArtifact,
  type AgentJudgeInput,
} from "./index";

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
    expect(report.guidanceResults).toEqual([
      expect.objectContaining({
        caseId: "okf-context-discovery",
        passed: true,
        score: 1,
      }),
      expect.objectContaining({
        caseId: "okf-reviewable-write-policy",
        passed: true,
        score: 1,
      }),
    ]);
  });

  test("scores agent behavior with an external judge when provided", async () => {
    const judgeInputs: AgentJudgeInput[] = [];
    const report = await runAgentEvalSuite({
      cases: [agentEvalCases[0]!],
      judge: {
        name: "fake-judge",
        evaluate: async (input) => {
          judgeInputs.push(input);
          return {
            improvements: ["cite the OKF path in the reply"],
            passed: true,
            rationale: "The proposal is grounded in the user note and requires review.",
            score: 0.9,
          };
        },
      },
    });

    expect(judgeInputs).toEqual([
      expect.objectContaining({
        agentPrompt: expect.stringContaining("/workspace/okf"),
        caseId: "journal-follow-up-maya-travel",
        criteria: expect.arrayContaining([expect.stringContaining("Grounded")]),
        output: expect.objectContaining({
          proposalRationale: expect.stringContaining("Grounded in captured user note"),
          requiresReview: true,
        }),
      }),
    ]);
    expect(report.judgeResults).toEqual([
      {
        candidateId: "current",
        caseId: "journal-follow-up-maya-travel",
        improvements: ["cite the OKF path in the reply"],
        judge: "fake-judge",
        passed: true,
        rationale: "The proposal is grounded in the user note and requires review.",
        score: 0.9,
      },
    ]);
  });

  test("can judge eval output through Codex CLI subscription runtime", async () => {
    const prompts: string[] = [];
    const judge = createCodexCliJudge({
      run: async ({ prompt }) => {
        prompts.push(prompt);
        return JSON.stringify({
          improvements: ["read the OKF file before proposing"],
          passed: true,
          rationale: "Codex judged the agent behavior.",
          score: 0.88,
        });
      },
    });

    const report = await runAgentEvalSuite({
      cases: [agentEvalCases[0]!],
      judge,
    });

    expect(prompts[0]).toContain("Return only JSON");
    expect(prompts[0]).toContain("journal-follow-up-maya-travel");
    expect(report.judgeResults[0]).toEqual(
      expect.objectContaining({
        improvements: ["read the OKF file before proposing"],
        judge: "codex-cli",
        score: 0.88,
      }),
    );
  });

  test("compares prompt candidates and emits eval artifacts", async () => {
    const artifacts: AgentEvalArtifact[] = [];
    const report = await runAgentEvalSuite({
      artifactSink: async (records) => {
        artifacts.push(...records);
      },
      candidates: [
        { id: "current", prompt: "Use /workspace/okf and proposal_write." },
        { id: "candidate", prompt: "Use /workspace/okf, okf_search, okf_read, proposal_write." },
      ],
      cases: [agentEvalCases[0]!],
      judge: {
        name: "fake-judge",
        evaluate: async (input) => ({
          improvements: input.candidateId === "current" ? ["read exact OKF file"] : [],
          passed: true,
          rationale: `${input.candidateId} scored`,
          score: input.candidateId === "candidate" ? 1 : 0.7,
        }),
      },
    });

    expect(report.candidateSummaries).toEqual([
      expect.objectContaining({ candidateId: "candidate", rank: 1 }),
      expect.objectContaining({ candidateId: "current", rank: 2 }),
    ]);
    expect(artifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ candidateId: "candidate", type: "judge_result" }),
        expect.objectContaining({ candidateId: "current", type: "candidate_summary" }),
      ]),
    );
  });

  test("can run eval cases against a live HTTP agent endpoint", async () => {
    const requested: string[] = [];
    const agent = createHttpAgentRunner({
      baseUrl: "https://lares.test",
      fetch: async (input, init) => {
        requested.push(String(input));
        expect(init?.method).toBe("POST");
        return Response.json({
          draft: {
            proposal: {
              body: "Follow up with Maya about travel plan.",
              kind: "follow_up",
              title: "Follow up on travel plan",
            },
          },
          reply: "Drafted a reviewable proposal.",
        });
      },
    });

    const report = await runAgentEvalSuite({
      agent,
      cases: [agentEvalCases[0]!],
    });

    expect(requested).toEqual([
      "https://lares.test/api/conversations/eval-current-journal-follow-up-maya-travel/messages",
    ]);
    expect(report.results[0]).toEqual(
      expect.objectContaining({
        agent: "http-agent",
        passed: true,
      }),
    );
  });

  test("renders a Codex agent improvement packet", async () => {
    const report = await runAgentEvalSuite({
      cases: [agentEvalCases[0]!],
      judge: {
        name: "fake-judge",
        evaluate: async () => ({
          improvements: ["cite the OKF path in the reply"],
          passed: false,
          rationale: "The answer is useful but not source-addressable.",
          score: 0.6,
        }),
      },
    });

    const packet = renderCodexEvalReport(report);

    expect(packet).toContain("# Codex Agent Eval Improvement Packet");
    expect(packet).toContain("Do not apply patches automatically");
    expect(packet).toContain("cite the OKF path in the reply");
    expect(packet).toContain("journal-follow-up-maya-travel");
  });
});
