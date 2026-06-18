import { runAgentEvalSuite } from "./index";

const report = await runAgentEvalSuite();

for (const result of report.results) {
  const status = result.passed ? "PASS" : "FAIL";
  console.log(`${status} ${result.caseId} score=${result.score.toFixed(2)}`);
  if (result.notes.length > 0) {
    console.log(`  notes: ${result.notes.join("; ")}`);
  }
  console.log(`  proposal: ${result.output.proposalKind} | ${result.output.proposalTitle}`);
}

console.log(`Agent eval score=${report.score.toFixed(2)}`);

if (!report.passed) {
  throw new Error("Agent eval suite failed");
}
