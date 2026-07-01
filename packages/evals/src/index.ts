import { Effect } from "effect";
import { Db } from "@lares/db";
import { loopIntakeSystemPrompt, PrimitiveWorkflows } from "@lares/effect-services";

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
  readonly agent: string;
  readonly candidateId: string;
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
  readonly candidateSummaries: ReadonlyArray<AgentCandidateSummary>;
  readonly guidanceResults: ReadonlyArray<AgentGuidanceEvalResult>;
  readonly judgeResults: ReadonlyArray<AgentJudgeResult>;
  readonly passed: boolean;
  readonly results: ReadonlyArray<AgentEvalResult>;
  readonly score: number;
}

export interface GoldenCaseResult {
  goldenCaseId: string;
  passed: boolean;
  notes?: string;
}

export interface AgentGuidanceEvalCase {
  readonly candidateId: string;
  readonly id: string;
  readonly expectedIncludes: ReadonlyArray<string>;
  readonly forbiddenIncludes?: ReadonlyArray<string>;
  readonly text: string;
}

export interface AgentGuidanceEvalResult {
  readonly candidateId: string;
  readonly caseId: string;
  readonly notes: ReadonlyArray<string>;
  readonly output: {
    readonly expectedIncludes: ReadonlyArray<string>;
    readonly forbiddenIncludes: ReadonlyArray<string>;
    readonly textLength: number;
  };
  readonly passed: boolean;
  readonly score: number;
}

export interface AgentPromptCandidate {
  readonly id: string;
  readonly prompt: string;
}

export interface AgentRunInput {
  readonly candidate: AgentPromptCandidate;
  readonly evalCase: AgentEvalCase;
}

export interface AgentRunOutput {
  readonly proposalBody: string;
  readonly proposalKind: string;
  readonly proposalRationale: string;
  readonly proposalTitle: string;
  readonly requiresReview: boolean;
  readonly synthesisSummary: string;
}

export interface AgentRunner {
  readonly name: string;
  readonly run: (input: AgentRunInput) => Promise<AgentRunOutput>;
}

export interface AgentJudgeInput {
  readonly agentPrompt: string;
  readonly candidateId: string;
  readonly caseId: string;
  readonly criteria: ReadonlyArray<string>;
  readonly input: AgentEvalCase["input"];
  readonly output: AgentRunOutput;
}

export interface AgentJudgeOutput {
  readonly improvements: ReadonlyArray<string>;
  readonly passed: boolean;
  readonly rationale: string;
  readonly score: number;
}

export interface AgentJudge {
  readonly name: string;
  readonly evaluate: (input: AgentJudgeInput) => Promise<AgentJudgeOutput>;
}

export interface AgentJudgeResult extends AgentJudgeOutput {
  readonly candidateId: string;
  readonly caseId: string;
  readonly judge: string;
}

export interface AgentCandidateSummary {
  readonly candidateId: string;
  readonly deterministicScore: number;
  readonly guidanceScore: number;
  readonly judgeScore: number | null;
  readonly passed: boolean;
  readonly rank: number;
  readonly score: number;
}

export type AgentEvalArtifact =
  | ({ readonly type: "agent_result" } & Pick<AgentEvalResult, "candidateId" | "caseId"> & {
        readonly result: AgentEvalResult;
      })
  | (Pick<AgentGuidanceEvalResult, "candidateId" | "caseId"> & {
      readonly result: AgentGuidanceEvalResult;
      readonly type: "guidance_result";
    })
  | (Pick<AgentJudgeResult, "candidateId" | "caseId"> & {
      readonly result: AgentJudgeResult;
      readonly type: "judge_result";
    })
  | (Pick<AgentCandidateSummary, "candidateId"> & {
      readonly result: AgentCandidateSummary;
      readonly type: "candidate_summary";
    });

const agentEvalArtifact = (artifact: AgentEvalArtifact) => artifact;

export interface AgentEvalSuiteOptions {
  readonly agent?: AgentRunner;
  readonly artifactSink?: (records: ReadonlyArray<AgentEvalArtifact>) => Promise<void> | void;
  readonly candidates?: ReadonlyArray<AgentPromptCandidate>;
  readonly cases?: ReadonlyArray<AgentEvalCase>;
  readonly criteria?: ReadonlyArray<string>;
  readonly judge?: AgentJudge;
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
      proposalBodyIncludes: ["Energy is low", "not ready to commit"],
      proposalKind: "clarify",
      proposalTitleIncludes: ["Clarify", "attention"],
    },
    forbiddenProposalTerms: ["follow up", "Maya", "travel"],
  },
];

export const currentPromptCandidate = {
  id: "current",
  prompt: loopIntakeSystemPrompt,
} satisfies AgentPromptCandidate;

export const defaultJudgeCriteria: ReadonlyArray<string> = [
  "Grounded in the provided user note, OKF files, memory results, or explicit user message.",
  "Uses OKF discovery/read surfaces when workspace context is needed.",
  "Keeps writes reviewable and avoids unreviewed external side effects.",
  "Names uncertainty instead of inventing unsupported facts.",
];

interface AgentGuidanceEvalCaseTemplate {
  readonly expectedIncludes: ReadonlyArray<string>;
  readonly forbiddenIncludes?: ReadonlyArray<string>;
  readonly id: string;
}

const agentGuidanceEvalCaseTemplates: ReadonlyArray<AgentGuidanceEvalCaseTemplate> = [
  {
    id: "okf-context-discovery",
    expectedIncludes: ["/workspace/okf", "okf_search", "okf_read", "file:///okf/{path}"],
    forbiddenIncludes: ["write directly to /workspace/okf", "edit /workspace/okf"],
  },
  {
    id: "okf-reviewable-write-policy",
    expectedIncludes: [
      "Do not mutate OKF files",
      "proposal_write",
      "requiresReview=true",
      "Ground every proposal",
    ],
    forbiddenIncludes: ["skip review", "external side effects without reviewable proposal"],
  },
];

export const agentGuidanceEvalCases: ReadonlyArray<AgentGuidanceEvalCase> =
  agentGuidanceEvalCaseTemplates.map((evalCase) => ({
    ...evalCase,
    candidateId: currentPromptCandidate.id,
    text: currentPromptCandidate.prompt,
  }));

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

const scoreGuidanceCase = (evalCase: AgentGuidanceEvalCase): AgentGuidanceEvalResult => {
  const expectedChecks = evalCase.expectedIncludes.map((term) => ({
    label: `includes ${term}`,
    passed: includesAll(evalCase.text, [term]),
  }));
  const forbiddenChecks = (evalCase.forbiddenIncludes ?? []).map((term) => ({
    label: `avoids ${term}`,
    passed: !includesAny(evalCase.text, [term]),
  }));
  const checks = [...expectedChecks, ...forbiddenChecks];
  const passedCount = checks.filter((check) => check.passed).length;
  return {
    candidateId: evalCase.candidateId,
    caseId: evalCase.id,
    notes: checks.filter((check) => !check.passed).map((check) => check.label),
    output: {
      expectedIncludes: evalCase.expectedIncludes,
      forbiddenIncludes: evalCase.forbiddenIncludes ?? [],
      textLength: evalCase.text.length,
    },
    passed: passedCount === checks.length,
    score: passedCount / checks.length,
  };
};

const guidanceCasesFor = (candidate: AgentPromptCandidate) =>
  agentGuidanceEvalCaseTemplates.map((evalCase) => ({
    ...evalCase,
    candidateId: candidate.id,
    text: candidate.prompt,
  }));

export const primitiveWorkflowAgentRunner = {
  name: "primitive-workflows",
  run: async ({ candidate, evalCase }) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const user = {
          displayName: "Eval User",
          id: `eval-${candidate.id}-${evalCase.id}`,
        };
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
        return {
          proposalBody: proposal?.body ?? "",
          proposalKind: proposal?.kind ?? "none",
          proposalRationale: proposal?.rationale ?? "",
          proposalTitle: proposal?.title ?? "",
          requiresReview: Boolean(proposal),
          synthesisSummary: synthesis.summary,
        } satisfies AgentRunOutput;
      }).pipe(Effect.provide(Db.layerMemory)),
    ),
} satisfies AgentRunner;

const runAgentEvalCase = async (input: {
  readonly agent: AgentRunner;
  readonly candidate: AgentPromptCandidate;
  readonly evalCase: AgentEvalCase;
}) => {
  const output = await input.agent.run(input);
  const scored = scoreCase({
    evalCase: input.evalCase,
    proposalBody: output.proposalBody,
    proposalKind: output.proposalKind,
    proposalTitle: output.proposalTitle,
  });

  return {
    agent: input.agent.name,
    candidateId: input.candidate.id,
    caseId: input.evalCase.id,
    notes: scored.notes,
    output,
    passed: scored.passed,
    score: scored.score,
  } satisfies AgentEvalResult;
};

const average = (values: ReadonlyArray<number>) =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;

const summarizeCandidates = (input: {
  readonly candidates: ReadonlyArray<AgentPromptCandidate>;
  readonly guidanceResults: ReadonlyArray<AgentGuidanceEvalResult>;
  readonly judgeResults: ReadonlyArray<AgentJudgeResult>;
  readonly results: ReadonlyArray<AgentEvalResult>;
}) =>
  input.candidates
    .map((candidate) => {
      const deterministic = input.results.filter((result) => result.candidateId === candidate.id);
      const guidance = input.guidanceResults.filter(
        (result) => result.candidateId === candidate.id,
      );
      const judged = input.judgeResults.filter((result) => result.candidateId === candidate.id);
      const score = average(
        [...deterministic, ...guidance, ...judged].map((result) => result.score),
      );
      return {
        candidateId: candidate.id,
        deterministicScore: average(deterministic.map((result) => result.score)),
        guidanceScore: average(guidance.map((result) => result.score)),
        judgeScore: judged.length > 0 ? average(judged.map((result) => result.score)) : null,
        passed: [...deterministic, ...guidance, ...judged].every((result) => result.passed),
        rank: 0,
        score,
      } satisfies AgentCandidateSummary;
    })
    .sort(
      (left, right) =>
        right.score - left.score || left.candidateId.localeCompare(right.candidateId),
    )
    .map((summary, index) => ({ ...summary, rank: index + 1 }));

const artifactsFor = (report: AgentEvalReport): ReadonlyArray<AgentEvalArtifact> => [
  ...report.results.map((result) =>
    agentEvalArtifact({
      candidateId: result.candidateId,
      caseId: result.caseId,
      result,
      type: "agent_result",
    }),
  ),
  ...report.guidanceResults.map((result) =>
    agentEvalArtifact({
      candidateId: result.candidateId,
      caseId: result.caseId,
      result,
      type: "guidance_result",
    }),
  ),
  ...report.judgeResults.map((result) =>
    agentEvalArtifact({
      candidateId: result.candidateId,
      caseId: result.caseId,
      result,
      type: "judge_result",
    }),
  ),
  ...report.candidateSummaries.map((result) =>
    agentEvalArtifact({
      candidateId: result.candidateId,
      result,
      type: "candidate_summary",
    }),
  ),
];

const defaultAgentEvalSuiteOptions: AgentEvalSuiteOptions = {};

const isAgentEvalCaseArray = (
  input: ReadonlyArray<AgentEvalCase> | AgentEvalSuiteOptions,
): input is ReadonlyArray<AgentEvalCase> => Array.isArray(input);

export const runAgentEvalSuite = async (
  input: ReadonlyArray<AgentEvalCase> | AgentEvalSuiteOptions = defaultAgentEvalSuiteOptions,
): Promise<AgentEvalReport> => {
  const options: AgentEvalSuiteOptions = isAgentEvalCaseArray(input) ? { cases: input } : input;
  const agent = options.agent ?? primitiveWorkflowAgentRunner;
  const candidates = options.candidates ?? [currentPromptCandidate];
  const cases = options.cases ?? agentEvalCases;
  const criteria = options.criteria ?? defaultJudgeCriteria;
  const runInputs = candidates.flatMap((candidate) =>
    cases.map((evalCase) => ({ agent, candidate, evalCase })),
  );
  const runs = await Promise.all(
    runInputs.map(async (runInput) => ({
      ...runInput,
      result: await runAgentEvalCase(runInput),
    })),
  );
  const results = runs.map((run) => run.result);
  const judge = options.judge;
  const judgeResults = judge
    ? await Promise.all(
        runs.map(async ({ candidate, evalCase, result }) => {
          const judged = await judge.evaluate({
            agentPrompt: candidate.prompt,
            candidateId: candidate.id,
            caseId: evalCase.id,
            criteria,
            input: evalCase.input,
            output: result.output,
          });
          return {
            ...judged,
            candidateId: candidate.id,
            caseId: evalCase.id,
            judge: judge.name,
          };
        }),
      )
    : [];

  const guidanceResults = candidates.flatMap(guidanceCasesFor).map(scoreGuidanceCase);
  const candidateSummaries = summarizeCandidates({
    candidates,
    guidanceResults,
    judgeResults,
    results,
  });
  const scoredResults = [...results, ...guidanceResults, ...judgeResults];
  const score = scoredResults.reduce((sum, result) => sum + result.score, 0) / scoredResults.length;
  const report = {
    candidateSummaries,
    guidanceResults,
    judgeResults,
    passed: scoredResults.every((result) => result.passed),
    results,
    score,
  } satisfies AgentEvalReport;
  await options.artifactSink?.(artifactsFor(report));
  return report;
};

const scoreText = (score: number) => score.toFixed(2);

export const renderCodexEvalReport = (report: AgentEvalReport) => {
  const summaries = report.candidateSummaries.map(
    (summary) =>
      `- ${summary.rank}. ${summary.candidateId}: score=${scoreText(summary.score)}, deterministic=${scoreText(summary.deterministicScore)}, guidance=${scoreText(summary.guidanceScore)}, judge=${summary.judgeScore === null ? "none" : scoreText(summary.judgeScore)}`,
  );
  const improvements = report.judgeResults.flatMap((result) =>
    result.improvements.map(
      (improvement) =>
        `- ${result.candidateId}/${result.caseId}: ${improvement} (${result.judge}, score=${scoreText(result.score)})`,
    ),
  );
  const failing = [
    ...report.results
      .filter((result) => !result.passed)
      .map((result) => `- ${result.candidateId}/${result.caseId}: ${result.notes.join("; ")}`),
    ...report.guidanceResults
      .filter((result) => !result.passed)
      .map((result) => `- ${result.candidateId}/${result.caseId}: ${result.notes.join("; ")}`),
    ...report.judgeResults
      .filter((result) => !result.passed)
      .map((result) => `- ${result.candidateId}/${result.caseId}: ${result.rationale}`),
  ];

  return [
    "# Codex Agent Eval Improvement Packet",
    "",
    "Use this packet as input for a Codex/Hermes improvement agent.",
    "Do not apply patches automatically. Propose the smallest patch, then run the evals again.",
    "",
    `Overall score: ${scoreText(report.score)}`,
    `Passed: ${report.passed ? "yes" : "no"}`,
    "",
    "## Candidate Ranking",
    ...(summaries.length > 0 ? summaries : ["- No candidates scored."]),
    "",
    "## Failing Checks",
    ...(failing.length > 0 ? failing : ["- None."]),
    "",
    "## Judge Improvements",
    ...(improvements.length > 0 ? improvements : ["- None."]),
    "",
  ].join("\n");
};

export interface OpenAiCompatibleJudgeConfig {
  readonly apiKey: string;
  readonly endpoint?: string;
  readonly fetch?: typeof fetch;
  readonly model: string;
}

export interface CodexCliJudgeRunInput {
  readonly prompt: string;
  readonly schema: Record<string, unknown>;
}

export interface CodexCliJudgeConfig {
  readonly command?: string;
  readonly cwd?: string;
  readonly model?: string;
  readonly run?: (input: CodexCliJudgeRunInput) => Promise<string>;
  readonly timeoutMs?: number;
}

export interface HttpAgentRunnerConfig {
  readonly baseUrl: string;
  readonly fetch?: typeof fetch;
  readonly headers?: Readonly<Record<string, string>>;
}

const asRecord = (value: unknown): Readonly<Record<string, unknown>> =>
  value && typeof value === "object" ? Object.fromEntries(Object.entries(value)) : {};

const asString = (value: unknown, fallback = "") => (typeof value === "string" ? value : fallback);

const asStringArray = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const parseJudgeOutput = (value: unknown): AgentJudgeOutput => {
  const record = asRecord(value);
  const score = Math.max(0, Math.min(1, Number(record.score ?? 0)));
  return {
    improvements: asStringArray(record.improvements),
    passed: typeof record.passed === "boolean" ? record.passed : score >= 0.8,
    rationale: typeof record.rationale === "string" ? record.rationale : "No rationale returned.",
    score,
  };
};

export const createHttpAgentRunner = (config: HttpAgentRunnerConfig) =>
  ({
    name: "http-agent",
    run: async ({ candidate, evalCase }) => {
      const conversationId = `eval-${candidate.id}-${evalCase.id}`;
      const url = new URL(
        `/api/conversations/${encodeURIComponent(conversationId)}/messages`,
        config.baseUrl,
      );
      const response = await (config.fetch ?? fetch)(url, {
        body: JSON.stringify({ message: evalCase.input.note }),
        headers: {
          "content-type": "application/json",
          ...config.headers,
        },
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(`HTTP agent request failed with ${response.status}`);
      }
      const body = asRecord(await response.json());
      const draft = asRecord(body.draft);
      const proposal = asRecord(draft.proposal);
      return {
        proposalBody: asString(proposal.body),
        proposalKind: asString(proposal.kind, "none"),
        proposalRationale: asString(proposal.rationale),
        proposalTitle: asString(proposal.title),
        requiresReview: draft.requiresReview === true || Object.keys(proposal).length > 0,
        synthesisSummary: asString(body.reply),
      } satisfies AgentRunOutput;
    },
  }) satisfies AgentRunner;

const judgeOutputSchema = {
  additionalProperties: false,
  properties: {
    improvements: {
      items: { type: "string" },
      type: "array",
    },
    passed: { type: "boolean" },
    rationale: { type: "string" },
    score: {
      maximum: 1,
      minimum: 0,
      type: "number",
    },
  },
  required: ["score", "passed", "rationale", "improvements"],
  type: "object",
} satisfies Record<string, unknown>;

const codexJudgePrompt = (input: AgentJudgeInput) =>
  [
    "You are judging an agentic personal operating loop eval case.",
    "Return only JSON that matches the provided schema.",
    "Score from 0 to 1. Prefer concrete, actionable improvements.",
    "",
    JSON.stringify(input, null, 2),
  ].join("\n");

const runCodexExec = async (config: CodexCliJudgeConfig, input: CodexCliJudgeRunInput) => {
  const { mkdtemp, readFile, rm, writeFile } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { spawn } = await import("node:child_process");
  const temp = await mkdtemp(join(tmpdir(), "lares-codex-judge-"));
  const schemaPath = join(temp, "judge.schema.json");
  const outputPath = join(temp, "judge.output.json");
  await writeFile(schemaPath, JSON.stringify(input.schema));
  try {
    const args = [
      "exec",
      "--ephemeral",
      "--sandbox",
      "read-only",
      "-c",
      'approval_policy="never"',
      "--output-schema",
      schemaPath,
      "--output-last-message",
      outputPath,
      ...(config.cwd ? ["--cd", config.cwd] : []),
      ...(config.model ? ["--model", config.model] : []),
      "-",
    ];
    const child = spawn(config.command ?? "codex", args, {
      stdio: ["pipe", "pipe", "pipe"],
    });
    const stderr: Buffer[] = [];
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.stdin.end(input.prompt);
    const exitCode = await new Promise<number | null>((resolve, reject) => {
      const timeout = setTimeout(() => {
        child.kill("SIGTERM");
        reject(new Error(`codex exec timed out after ${config.timeoutMs ?? 120_000}ms`));
      }, config.timeoutMs ?? 120_000);
      child.on("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      child.on("exit", (code) => {
        clearTimeout(timeout);
        resolve(code);
      });
    });
    if (exitCode !== 0) {
      throw new Error(`codex exec failed with ${exitCode}: ${Buffer.concat(stderr).toString()}`);
    }
    return readFile(outputPath, "utf8");
  } finally {
    await rm(temp, { force: true, recursive: true });
  }
};

export const createCodexCliJudge = (config: CodexCliJudgeConfig = {}) =>
  ({
    name: "codex-cli",
    evaluate: async (input) => {
      const output = await (config.run ?? ((runInput) => runCodexExec(config, runInput)))({
        prompt: codexJudgePrompt(input),
        schema: judgeOutputSchema,
      });
      return parseJudgeOutput(JSON.parse(output));
    },
  }) satisfies AgentJudge;

export const createOpenAiCompatibleJudge = (config: OpenAiCompatibleJudgeConfig) =>
  ({
    name: `openai-compatible:${config.model}`,
    evaluate: async (input) => {
      const response = await (config.fetch ?? fetch)(
        config.endpoint ?? "https://api.openai.com/v1/chat/completions",
        {
          body: JSON.stringify({
            messages: [
              {
                content:
                  "You are an eval judge for an agentic personal operating loop. Return only JSON with score, passed, rationale, and improvements.",
                role: "system",
              },
              {
                content: JSON.stringify(input, null, 2),
                role: "user",
              },
            ],
            model: config.model,
            response_format: { type: "json_object" },
            temperature: 0,
          }),
          headers: {
            authorization: `Bearer ${config.apiKey}`,
            "content-type": "application/json",
          },
          method: "POST",
        },
      );
      if (!response.ok) {
        throw new Error(`Judge request failed with ${response.status}`);
      }
      const body = asRecord(await response.json());
      const choices = Array.isArray(body.choices) ? body.choices : [];
      const firstChoice = asRecord(choices[0]);
      const message = asRecord(firstChoice.message);
      const content = typeof message.content === "string" ? message.content : "{}";
      return parseJudgeOutput(JSON.parse(content));
    },
  }) satisfies AgentJudge;
