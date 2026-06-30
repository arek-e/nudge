import {
  createCodexCliJudge,
  createHttpAgentRunner,
  createOpenAiCompatibleJudge,
  currentPromptCandidate,
  renderCodexEvalReport,
  runAgentEvalSuite,
  type AgentEvalArtifact,
  type AgentEvalSuiteOptions,
  type AgentPromptCandidate,
} from "./index";

const args = process.argv.slice(2);
const jsonlArg = args.find((arg) => arg.startsWith("--jsonl="));
const codexReportArg = args.find((arg) => arg.startsWith("--codex-report="));
const candidateArgs = args.filter((arg) => arg.startsWith("--candidate="));
const judgeArg = args.find((arg) => arg.startsWith("--judge="));
const agentUrlArg = args.find((arg) => arg.startsWith("--agent-url="));
const judgeApiKey = process.env.EVAL_JUDGE_API_KEY;
const agentUrl = agentUrlArg?.slice("--agent-url=".length) ?? process.env.EVAL_AGENT_URL;
const judgeMode = judgeArg?.slice("--judge=".length);

const readCandidate = async (arg: string): Promise<AgentPromptCandidate> => {
  const spec = arg.slice("--candidate=".length);
  const separator = spec.indexOf(":");
  if (separator < 1) throw new Error("--candidate must be id:path");
  const id = spec.slice(0, separator);
  const path = spec.slice(separator + 1);
  const { readFile } = await import("node:fs/promises");
  return { id, prompt: await readFile(path, "utf8") };
};

const candidates =
  candidateArgs.length > 0
    ? [currentPromptCandidate, ...(await Promise.all(candidateArgs.map(readCandidate)))]
    : undefined;

if (judgeMode === "llm" && !judgeApiKey) {
  throw new Error("EVAL_JUDGE_API_KEY is required for --judge=llm");
}

if (judgeMode && !["codex", "llm"].includes(judgeMode)) {
  throw new Error("--judge must be codex or llm");
}

const judge =
  judgeMode === "llm"
    ? createOpenAiCompatibleJudge({
        ...(process.env.EVAL_JUDGE_ENDPOINT ? { endpoint: process.env.EVAL_JUDGE_ENDPOINT } : {}),
        apiKey: judgeApiKey!,
        model: process.env.EVAL_JUDGE_MODEL ?? "gpt-4.1-mini",
      })
    : judgeMode === "codex"
      ? createCodexCliJudge({
          ...(process.env.EVAL_CODEX_COMMAND ? { command: process.env.EVAL_CODEX_COMMAND } : {}),
          cwd: process.env.EVAL_CODEX_CWD ?? process.cwd(),
          ...(process.env.EVAL_CODEX_MODEL ? { model: process.env.EVAL_CODEX_MODEL } : {}),
          ...(process.env.EVAL_CODEX_TIMEOUT_MS
            ? { timeoutMs: Number(process.env.EVAL_CODEX_TIMEOUT_MS) }
            : {}),
        })
      : undefined;

const agent = agentUrl
  ? createHttpAgentRunner({
      baseUrl: agentUrl,
      headers: {
        ...(process.env.EVAL_AGENT_AUTHORIZATION
          ? { authorization: process.env.EVAL_AGENT_AUTHORIZATION }
          : {}),
        ...(process.env.EVAL_AGENT_COOKIE ? { cookie: process.env.EVAL_AGENT_COOKIE } : {}),
      },
    })
  : undefined;

const artifactSink = jsonlArg
  ? async (records: ReadonlyArray<AgentEvalArtifact>) => {
      const { writeFile } = await import("node:fs/promises");
      await writeFile(
        jsonlArg.slice("--jsonl=".length),
        `${records.map((record) => JSON.stringify(record)).join("\n")}\n`,
      );
    }
  : undefined;

const suiteOptions: AgentEvalSuiteOptions = {
  ...(agent ? { agent } : {}),
  ...(artifactSink ? { artifactSink } : {}),
  ...(candidates ? { candidates } : {}),
  ...(judge ? { judge } : {}),
};

const report = await runAgentEvalSuite(suiteOptions);

if (codexReportArg) {
  const { writeFile } = await import("node:fs/promises");
  await writeFile(codexReportArg.slice("--codex-report=".length), renderCodexEvalReport(report));
}

for (const result of report.results) {
  const status = result.passed ? "PASS" : "FAIL";
  console.log(`${status} ${result.candidateId}/${result.caseId} score=${result.score.toFixed(2)}`);
  if (result.notes.length > 0) {
    console.log(`  notes: ${result.notes.join("; ")}`);
  }
  console.log(`  proposal: ${result.output.proposalKind} | ${result.output.proposalTitle}`);
}

for (const result of report.guidanceResults) {
  const status = result.passed ? "PASS" : "FAIL";
  console.log(`${status} ${result.candidateId}/${result.caseId} score=${result.score.toFixed(2)}`);
  if (result.notes.length > 0) {
    console.log(`  notes: ${result.notes.join("; ")}`);
  }
  console.log(`  guidance terms: ${result.output.expectedIncludes.join(", ")}`);
}

for (const result of report.judgeResults) {
  const status = result.passed ? "PASS" : "FAIL";
  console.log(
    `${status} ${result.candidateId}/${result.caseId} judge=${result.judge} score=${result.score.toFixed(2)}`,
  );
  console.log(`  rationale: ${result.rationale}`);
  if (result.improvements.length > 0) {
    console.log(`  improvements: ${result.improvements.join("; ")}`);
  }
}

for (const summary of report.candidateSummaries) {
  console.log(
    `RANK ${summary.rank} ${summary.candidateId} score=${summary.score.toFixed(2)} deterministic=${summary.deterministicScore.toFixed(2)} guidance=${summary.guidanceScore.toFixed(2)} judge=${summary.judgeScore?.toFixed(2) ?? "none"}`,
  );
}

console.log(`Agent eval score=${report.score.toFixed(2)}`);

if (!report.passed) {
  throw new Error("Agent eval suite failed");
}
