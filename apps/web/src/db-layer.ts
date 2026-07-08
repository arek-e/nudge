import { makeFunctionReference } from "convex/server";
import { Layer } from "effect";
import { Db } from "@nudge/db";
import { convexDbLayer, makeConvexRuntimeLayer, type ConvexDbStoreApi } from "@nudge/db-convex";
import type { Env } from "./env";

const convexStoreApi = {
  appendCommitment: makeFunctionReference<"mutation">("store.js:appendCommitment"),
  appendEvent: makeFunctionReference<"mutation">("store.js:appendEvent"),
  appendProposal: makeFunctionReference<"mutation">("store.js:appendProposal"),
  appendSynthesis: makeFunctionReference<"mutation">("store.js:appendSynthesis"),
  completeAgentRun: makeFunctionReference<"mutation">("store.js:completeAgentRun"),
  deleteUserData: makeFunctionReference<"mutation">("store.js:deleteUserData"),
  ensureUser: makeFunctionReference<"mutation">("store.js:ensureUser"),
  exportUserData: makeFunctionReference<"query">("store.js:exportUserData"),
  getAgentRun: makeFunctionReference<"query">("store.js:getAgentRun"),
  getCurrentFrame: makeFunctionReference<"query">("store.js:getCurrentFrame"),
  getDailyNote: makeFunctionReference<"query">("store.js:getDailyNote"),
  getJournalDocument: makeFunctionReference<"query">("store.js:getJournalDocument"),
  getLatestSynthesis: makeFunctionReference<"query">("store.js:getLatestSynthesis"),
  getMemoryChunk: makeFunctionReference<"query">("store.js:getMemoryChunk"),
  getProposal: makeFunctionReference<"query">("store.js:getProposal"),
  getReviewForProposal: makeFunctionReference<"query">("store.js:getReviewForProposal"),
  listAgentRuns: makeFunctionReference<"query">("store.js:listAgentRuns"),
  listCommitments: makeFunctionReference<"query">("store.js:listCommitments"),
  listExtractedItems: makeFunctionReference<"query">("store.js:listExtractedItems"),
  listJournalDocuments: makeFunctionReference<"query">("store.js:listJournalDocuments"),
  listJournalRevisions: makeFunctionReference<"query">("store.js:listJournalRevisions"),
  listMemoryChunks: makeFunctionReference<"query">("store.js:listMemoryChunks"),
  listNoteRevisions: makeFunctionReference<"query">("store.js:listNoteRevisions"),
  listOutcomes: makeFunctionReference<"query">("store.js:listOutcomes"),
  listPendingMemoryIndexJobs: makeFunctionReference<"query">("store.js:listPendingMemoryIndexJobs"),
  listPendingProposals: makeFunctionReference<"query">("store.js:listPendingProposals"),
  listRecentEvents: makeFunctionReference<"query">("store.js:listRecentEvents"),
  listSummaryDocuments: makeFunctionReference<"query">("store.js:listSummaryDocuments"),
  markAgentRunRunning: makeFunctionReference<"mutation">("store.js:markAgentRunRunning"),
  markMemoryChunkIndexed: makeFunctionReference<"mutation">("store.js:markMemoryChunkIndexed"),
  recordItemEvent: makeFunctionReference<"mutation">("store.js:recordItemEvent"),
  recordMemoryRetrieval: makeFunctionReference<"mutation">("store.js:recordMemoryRetrieval"),
  recordOutcome: makeFunctionReference<"mutation">("store.js:recordOutcome"),
  reviewProposal: makeFunctionReference<"mutation">("store.js:reviewProposal"),
  setDailyNoteAgentStatus: makeFunctionReference<"mutation">("store.js:setDailyNoteAgentStatus"),
  startAgentRun: makeFunctionReference<"mutation">("store.js:startAgentRun"),
  updateExtractedItemStatus: makeFunctionReference<"mutation">(
    "store.js:updateExtractedItemStatus",
  ),
  upsertCurrentFrame: makeFunctionReference<"mutation">("store.js:upsertCurrentFrame"),
  upsertDailyNote: makeFunctionReference<"mutation">("store.js:upsertDailyNote"),
  upsertExtractedItem: makeFunctionReference<"mutation">("store.js:upsertExtractedItem"),
  upsertJournalDocument: makeFunctionReference<"mutation">("store.js:upsertJournalDocument"),
  upsertMemoryDocument: makeFunctionReference<"mutation">("store.js:upsertMemoryDocument"),
  upsertSummaryDocument: makeFunctionReference<"mutation">("store.js:upsertSummaryDocument"),
} satisfies ConvexDbStoreApi;

export type NudgeDbLayer = Layer.Layer<Db>;

const convexLayers = new WeakMap<Env, NudgeDbLayer>();

export function resolveDbLayerForEnv(env: Env, override?: NudgeDbLayer) {
  if (override) return override;
  if (!env.CONVEX_URL || !env.CONVEX_RUNTIME_SECRET) {
    throw new Error(
      "Convex runtime store is not configured. Set CONVEX_URL and CONVEX_RUNTIME_SECRET.",
    );
  }

  const existing = convexLayers.get(env);
  if (existing) return existing;
  const convexRuntimeLayer = makeConvexRuntimeLayer({
    runtimeSecret: env.CONVEX_RUNTIME_SECRET,
    store: convexStoreApi,
    url: env.CONVEX_URL,
  });
  const layer = convexDbLayer.pipe(Layer.provide(convexRuntimeLayer));
  convexLayers.set(env, layer);
  return layer;
}
