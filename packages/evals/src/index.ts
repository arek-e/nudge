import { Effect } from "effect";
import { Db } from "@lares/db";
import { PrimitiveWorkflows } from "@lares/effect-services";

export interface AgentEvalCase {
  readonly id: string;
  readonly input: {
    readonly note: string;
  };
  readonly expected: {
    readonly proposalBodyIncludes?: ReadonlyArray<string>;
    readonly proposalKind: "clarify" | "follow_up" | "commit" | "ignore";
    readonly proposalTitleIncludes: ReadonlyArray<string>;
  };
  readonly forbiddenProposalTerms?: ReadonlyArray<string>;
}

export interface AgentEvalResult {
  readonly caseId: string;
  readonly notes: ReadonlyArray<string>;
  readonly output: {
    readonly proposalBody: string;
    readonly proposalKind: string;
    readonly proposalTitle: string;
    readonly synthesisSummary: string;
  };
  readonly passed: boolean;
  readonly score: number;
}

export interface AgentEvalReport {
  readonly passed: boolean;
  readonly results: ReadonlyArray<AgentEvalResult>;
  readonly score: number;
}

export interface GoldenCaseResult {
  goldenCaseId: string;
  passed: boolean;
  notes?: string;
}

export const agentEvalCases: ReadonlyArray<AgentEvalCase> = [
  {
    id: "journal-follow-up-maya-travel",
    input: {
      note: "Follow up with Maya about the travel plan before lunch.",
    },
    expected: {
      proposalBodyIncludes: ["Maya", "travel plan"],
      proposalKind: "follow_up",
      proposalTitleIncludes: ["Follow up", "travel plan"],
    },
    forbiddenProposalTerms: ["Alex", "doctor", "invoice"],
  },
  {
    id: "journal-capture-more-context",
    input: {
      note: "Energy is low and I need to think before committing to anything new.",
    },
    expected: {
      proposalBodyIncludes: ["What needs attention next?"],
      proposalKind: "clarify",
      proposalTitleIncludes: ["Clarify", "attention"],
    },
    forbiddenProposalTerms: ["follow up", "Maya", "travel"],
  },
];

const includesAll = (text: string, expected: ReadonlyArray<string>) => {
  const normalized = text.toLowerCase();
  return expected.every((term) => normalized.includes(term.toLowerCase()));
};

const includesAny = (text: string, terms: ReadonlyArray<string>) => {
  const normalized = text.toLowerCase();
  return terms.some((term) => normalized.includes(term.toLowerCase()));
};

const scoreCase = (input: {
  readonly evalCase: AgentEvalCase;
  readonly proposalBody: string;
  readonly proposalKind: string;
  readonly proposalTitle: string;
}) => {
  const checks = [
    {
      label: `kind is ${input.evalCase.expected.proposalKind}`,
      passed: input.proposalKind === input.evalCase.expected.proposalKind,
    },
    {
      label: "title contains expected terms",
      passed: includesAll(input.proposalTitle, input.evalCase.expected.proposalTitleIncludes),
    },
    {
      label: "body contains expected terms",
      passed: includesAll(input.proposalBody, input.evalCase.expected.proposalBodyIncludes ?? []),
    },
    {
      label: "proposal avoids forbidden terms",
      passed: !includesAny(
        `${input.proposalTitle}\n${input.proposalBody}`,
        input.evalCase.forbiddenProposalTerms ?? [],
      ),
    },
  ];
  const passedCount = checks.filter((check) => check.passed).length;
  return {
    notes: checks.filter((check) => !check.passed).map((check) => check.label),
    passed: passedCount === checks.length,
    score: passedCount / checks.length,
  };
};

const runAgentEvalCase = (evalCase: AgentEvalCase) =>
  Effect.gen(function* () {
    const user = { displayName: "Eval User", id: `eval-${evalCase.id}` };
    yield* PrimitiveWorkflows.appendSignal({
      occurredAt: "2026-06-18T09:00:00.000Z",
      payload: { note: evalCase.input.note },
      schemaVersion: 1,
      source: "eval",
      type: "user_context_captured",
      user,
    });
    const { synthesis } = yield* PrimitiveWorkflows.createSynthesis({
      frameKey: "current_state",
      user,
    });
    const proposals = yield* PrimitiveWorkflows.generateProposals({
      frameKey: "current_state",
      user,
    });
    const proposal = proposals[0];
    if (!proposal) {
      return {
        caseId: evalCase.id,
        notes: ["no proposal generated"],
        output: {
          proposalBody: "",
          proposalKind: "none",
          proposalTitle: "",
          synthesisSummary: synthesis.summary,
        },
        passed: false,
        score: 0,
      } satisfies AgentEvalResult;
    }

    const scored = scoreCase({
      evalCase,
      proposalBody: proposal.body,
      proposalKind: proposal.kind,
      proposalTitle: proposal.title,
    });

    return {
      caseId: evalCase.id,
      notes: scored.notes,
      output: {
        proposalBody: proposal.body,
        proposalKind: proposal.kind,
        proposalTitle: proposal.title,
        synthesisSummary: synthesis.summary,
      },
      passed: scored.passed,
      score: scored.score,
    } satisfies AgentEvalResult;
  });

export const runAgentEvalSuite = async (
  cases: ReadonlyArray<AgentEvalCase> = agentEvalCases,
): Promise<AgentEvalReport> => {
  const results = await Effect.runPromise(
    Effect.all(cases.map(runAgentEvalCase), { concurrency: 1 }).pipe(
      Effect.provide(Db.layerMemory),
    ),
  );
  const score = results.reduce((sum, result) => sum + result.score, 0) / results.length;
  return {
    passed: results.every((result) => result.passed),
    results,
    score,
  };
};
