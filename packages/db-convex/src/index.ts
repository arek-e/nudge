import type { FunctionReference } from "convex/server";
import { ConvexHttpClient } from "convex/browser";
import { Context, Effect, Layer } from "effect";
import { Db, type DbService, type DbUser } from "@nudge/db";
import {
  buildTraceSpanRow,
  createSpanId,
  currentRuntimeTraceContext,
  safeExceptionAttributes,
  traceparentHeader,
  type RuntimeTraceContext,
} from "@nudge/observability";

type PublicMutation = FunctionReference<"mutation", "public">;
type PublicQuery = FunctionReference<"query", "public">;

export interface ConvexClient {
  readonly mutation: <A>(reference: PublicMutation, args: unknown) => Promise<A>;
  readonly query: <A>(reference: PublicQuery, args: unknown) => Promise<A>;
}

export interface ConvexDbStoreApi {
  readonly ensureUser: PublicMutation;
  readonly deleteUserData: PublicMutation;
  readonly exportUserData: PublicQuery;
  readonly appendEvent: PublicMutation;
  readonly listRecentEvents: PublicQuery;
  readonly upsertCurrentFrame: PublicMutation;
  readonly getCurrentFrame: PublicQuery;
  readonly appendSynthesis: PublicMutation;
  readonly getLatestSynthesis: PublicQuery;
  readonly appendProposal: PublicMutation;
  readonly listPendingProposals: PublicQuery;
  readonly getProposal: PublicQuery;
  readonly getReviewForProposal: PublicQuery;
  readonly reviewProposal: PublicMutation;
  readonly appendCommitment: PublicMutation;
  readonly listCommitments: PublicQuery;
  readonly recordOutcome: PublicMutation;
  readonly listOutcomes: PublicQuery;
  readonly upsertDailyNote: PublicMutation;
  readonly getDailyNote: PublicQuery;
  readonly listNoteRevisions: PublicQuery;
  readonly upsertExtractedItem: PublicMutation;
  readonly updateExtractedItemStatus: PublicMutation;
  readonly listExtractedItems: PublicQuery;
  readonly recordItemEvent: PublicMutation;
  readonly upsertSummaryDocument: PublicMutation;
  readonly listSummaryDocuments: PublicQuery;
  readonly startAgentRun: PublicMutation;
  readonly getAgentRun: PublicQuery;
  readonly listAgentRuns: PublicQuery;
  readonly markAgentRunRunning: PublicMutation;
  readonly completeAgentRun: PublicMutation;
  readonly upsertJournalDocument: PublicMutation;
  readonly getJournalDocument: PublicQuery;
  readonly listJournalDocuments: PublicQuery;
  readonly listJournalRevisions: PublicQuery;
  readonly upsertMemoryDocument: PublicMutation;
  readonly getMemoryChunk: PublicQuery;
  readonly listMemoryChunks: PublicQuery;
  readonly listPendingMemoryIndexJobs: PublicQuery;
  readonly markMemoryChunkIndexed: PublicMutation;
  readonly recordMemoryRetrieval: PublicMutation;
}

export interface ConvexRuntimeConfig {
  readonly runtimeSecret: string;
  readonly store: ConvexDbStoreApi;
  readonly url: string;
}

export interface ConvexRuntimeService {
  readonly client: ConvexClient;
  readonly runtimeSecret: string;
  readonly store: ConvexDbStoreApi;
  readonly url: string;
}

export class ConvexRuntime extends Context.Service<ConvexRuntime, ConvexRuntimeService>()(
  "nudge/db-convex/ConvexRuntime",
) {}

interface CachedUser {
  readonly displayName: string;
  readonly id: string;
}

interface RuntimeUser extends CachedUser {
  readonly runtimeSecret: string;
  readonly trace?: RuntimeTraceArg;
}

interface RuntimeTraceArg {
  readonly environment: string;
  readonly flags: string;
  readonly operation: string;
  readonly parentSpanId: string | null;
  readonly requestId?: string | null;
  readonly routeName?: string | null;
  readonly service: string;
  readonly spanId: string;
  readonly traceId: string;
  readonly traceparent: string;
  readonly version: string;
}

const anonymousDisplayName = (userId: string) => userId;

export function makeConvexRuntimeLayer(config: ConvexRuntimeConfig) {
  return Layer.effect(
    ConvexRuntime,
    Effect.sync(() => {
      const client = new ConvexHttpClient(config.url);
      return ConvexRuntime.of({
        client: {
          mutation: (reference, args) => client.mutation(reference, args),
          query: (reference, args) => client.query(reference, args),
        },
        runtimeSecret: config.runtimeSecret,
        store: config.store,
        url: config.url,
      });
    }),
  );
}

const runtimeTraceArg = (
  traceContext: RuntimeTraceContext | null,
  operation: string,
  spanId: string,
) =>
  traceContext
    ? {
        environment: traceContext.environment,
        flags: traceContext.flags,
        operation,
        parentSpanId: traceContext.parentSpanId,
        ...(traceContext.requestId ? { requestId: traceContext.requestId } : {}),
        ...(traceContext.routeName ? { routeName: traceContext.routeName } : {}),
        service: traceContext.service,
        spanId,
        traceId: traceContext.traceId,
        traceparent: traceparentHeader({
          flags: traceContext.flags,
          spanId,
          traceId: traceContext.traceId,
        }),
        version: traceContext.version,
      }
    : undefined;

const recordConvexSpan = (input: {
  readonly attributes: Readonly<Record<string, unknown>>;
  readonly durationMs: number;
  readonly endedAt: string;
  readonly operation: string;
  readonly spanId: string;
  readonly startedAt: string;
  readonly status: "ok" | "error";
  readonly traceContext: RuntimeTraceContext | null;
}) => {
  const traceContext = input.traceContext;
  if (!traceContext?.cacheable || !traceContext.recordSpan) return;
  traceContext.recordSpan(
    buildTraceSpanRow({
      attributes: input.attributes,
      durationMs: input.durationMs,
      endedAt: input.endedAt,
      environment: traceContext.environment,
      kind: "client",
      method: traceContext.method ?? null,
      name: `Convex store.${input.operation}`,
      outcome: input.status === "error" ? "error" : "success",
      parentSpanId: traceContext.parentSpanId,
      path: traceContext.path ?? null,
      requestId: traceContext.requestId ?? null,
      routeName: traceContext.routeName ?? null,
      service: traceContext.service,
      spanId: input.spanId,
      startedAt: input.startedAt,
      status: input.status,
      traceId: traceContext.traceId,
      version: traceContext.version,
    }),
  );
};

const nowMs = () => {
  try {
    return performance.now();
  } catch {
    return Date.now();
  }
};

const convexSpanAttributes = (
  operation: string,
  traceContext: RuntimeTraceContext | null,
  failureAttributes: Readonly<Record<string, unknown>>,
) => ({
  "db.system.name": "convex",
  "convex.operation": operation,
  "convex.runtime": "cloudflare",
  "nudge.db.provider": "convex",
  "nudge.request_id": traceContext?.requestId ?? null,
  ...failureAttributes,
});

export const convexDbLayer = Layer.effect(
  Db,
  Effect.gen(function* () {
    const convex = yield* ConvexRuntime;
    return Db.of(makeConvexDbService(convex));
  }),
);

export function makeConvexDbService(convex: ConvexRuntimeService): DbService {
  const client = convex.client;
  const store = convex.store;
  const users = new Map<string, CachedUser>();

  const cacheUser = (user: DbUser, trace?: RuntimeTraceArg) => {
    users.set(user.id, user);
    return runtimeUser(user, trace);
  };

  const runtimeUser = (user: CachedUser, trace?: RuntimeTraceArg): RuntimeUser => ({
    displayName: user.displayName,
    id: user.id,
    runtimeSecret: convex.runtimeSecret,
    ...(trace ? { trace } : {}),
  });

  const userFor = (userId: string, trace?: RuntimeTraceArg) =>
    runtimeUser(
      users.get(userId) ?? { displayName: anonymousDisplayName(userId), id: userId },
      trace,
    );

  const runConvex = <A>(operation: string, task: (trace?: RuntimeTraceArg) => Promise<A>) =>
    Effect.gen(function* () {
      const traceContext = yield* currentRuntimeTraceContext;
      const spanId = createSpanId();
      const startedAt = new Date().toISOString();
      const startedMs = nowMs();
      const trace = runtimeTraceArg(traceContext, operation, spanId);
      let status: "ok" | "error" = "ok";
      let failureAttributes: Readonly<Record<string, unknown>> = {};

      return yield* Effect.promise(async () => {
        try {
          return await task(trace);
        } catch (cause) {
          status = "error";
          failureAttributes = safeExceptionAttributes(cause);
          throw cause;
        } finally {
          const endedAt = new Date().toISOString();
          recordConvexSpan({
            attributes: {
              ...convexSpanAttributes(operation, traceContext, failureAttributes),
              "server.address": new URL(convex.url).host,
            },
            durationMs: Number((nowMs() - startedMs).toFixed(2)),
            endedAt,
            operation,
            spanId,
            startedAt,
            status,
            traceContext,
          });
        }
      }).pipe(
        Effect.withSpan(`Db.${operation}`, {
          attributes: {
            provider: "convex",
            "db.system.name": "convex",
            "convex.operation": operation,
            ...(traceContext?.requestId ? { "nudge.request_id": traceContext.requestId } : {}),
          },
        }),
      );
    });

  return {
    provider: "convex",
    ensureUser: (user) =>
      runConvex("ensureUser", async (trace) => {
        await client.mutation(store.ensureUser, { user: cacheUser(user, trace) });
      }),
    deleteUserData: (input) =>
      runConvex("deleteUserData", (trace) =>
        client.mutation(store.deleteUserData, { user: userFor(input.userId, trace) }),
      ),
    exportUserData: (user) =>
      runConvex("exportUserData", (trace) =>
        client.query(store.exportUserData, { user: cacheUser(user, trace) }),
      ),
    appendEvent: (input) =>
      runConvex("appendEvent", (trace) =>
        client.mutation(store.appendEvent, {
          user: userFor(input.userId, trace),
          type: input.type,
          source: input.source,
          occurredAt: input.occurredAt,
          schemaVersion: input.schemaVersion,
          ...(input.idempotencyKey !== undefined ? { idempotencyKey: input.idempotencyKey } : {}),
          payload: input.payload,
        }),
      ),
    listRecentEvents: (input) =>
      runConvex("listRecentEvents", (trace) =>
        client.query(store.listRecentEvents, {
          user: userFor(input.userId, trace),
          limit: input.limit,
          ...(input.occurredFrom !== undefined ? { occurredFrom: input.occurredFrom } : {}),
          ...(input.occurredTo !== undefined ? { occurredTo: input.occurredTo } : {}),
        }),
      ),
    upsertCurrentFrame: (input) =>
      runConvex("upsertCurrentFrame", (trace) =>
        client.mutation(store.upsertCurrentFrame, {
          user: userFor(input.userId, trace),
          key: input.key,
          title: input.title,
          prompt: input.prompt,
        }),
      ),
    getCurrentFrame: (input) =>
      runConvex("getCurrentFrame", (trace) =>
        client.query(store.getCurrentFrame, {
          user: userFor(input.userId, trace),
          key: input.key,
        }),
      ),
    appendSynthesis: (input) =>
      runConvex("appendSynthesis", (trace) =>
        client.mutation(store.appendSynthesis, {
          user: userFor(input.userId, trace),
          frameId: input.frameId,
          summary: input.summary,
          themes: [...input.themes],
          openQuestions: [...input.openQuestions],
          sourceSignalIds: [...input.sourceSignalIds],
        }),
      ),
    getLatestSynthesis: (input) =>
      runConvex("getLatestSynthesis", (trace) =>
        client.query(store.getLatestSynthesis, {
          user: userFor(input.userId, trace),
          frameId: input.frameId,
        }),
      ),
    appendProposal: (input) =>
      runConvex("appendProposal", (trace) =>
        client.mutation(store.appendProposal, {
          user: userFor(input.userId, trace),
          synthesisId: input.synthesisId,
          kind: input.kind,
          title: input.title,
          body: input.body,
          rationale: input.rationale,
        }),
      ),
    listPendingProposals: (input) =>
      runConvex("listPendingProposals", (trace) =>
        client.query(store.listPendingProposals, {
          user: userFor(input.userId, trace),
          limit: input.limit,
        }),
      ),
    getProposal: (input) =>
      runConvex("getProposal", (trace) =>
        client.query(store.getProposal, {
          user: userFor(input.userId, trace),
          proposalId: input.proposalId,
        }),
      ),
    getReviewForProposal: (input) =>
      runConvex("getReviewForProposal", (trace) =>
        client.query(store.getReviewForProposal, {
          user: userFor(input.userId, trace),
          proposalId: input.proposalId,
        }),
      ),
    reviewProposal: (input) =>
      runConvex("reviewProposal", (trace) =>
        client.mutation(store.reviewProposal, {
          user: userFor(input.userId, trace),
          proposalId: input.proposalId,
          decision: input.decision,
          ...(input.editedTitle !== undefined ? { editedTitle: input.editedTitle } : {}),
          ...(input.editedBody !== undefined ? { editedBody: input.editedBody } : {}),
          ...(input.editedBodyDocument !== undefined
            ? { editedBodyDocument: input.editedBodyDocument }
            : {}),
        }),
      ),
    appendCommitment: (input) =>
      runConvex("appendCommitment", (trace) =>
        client.mutation(store.appendCommitment, {
          user: userFor(input.userId, trace),
          proposalId: input.proposalId,
          reviewId: input.reviewId,
          title: input.title,
          body: input.body,
          ...(input.bodyDocument !== undefined ? { bodyDocument: input.bodyDocument } : {}),
        }),
      ),
    listCommitments: (input) =>
      runConvex("listCommitments", (trace) =>
        client.query(store.listCommitments, {
          user: userFor(input.userId, trace),
          limit: input.limit,
          ...(input.status !== undefined ? { status: input.status } : {}),
        }),
      ),
    recordOutcome: (input) =>
      runConvex("recordOutcome", (trace) =>
        client.mutation(store.recordOutcome, {
          user: userFor(input.userId, trace),
          commitmentId: input.commitmentId,
          result: input.result,
          ...(input.note !== undefined ? { note: input.note } : {}),
        }),
      ),
    listOutcomes: (input) =>
      runConvex("listOutcomes", (trace) =>
        client.query(store.listOutcomes, {
          user: userFor(input.userId, trace),
          limit: input.limit,
        }),
      ),
    upsertDailyNote: (input) =>
      runConvex("upsertDailyNote", (trace) =>
        client.mutation(store.upsertDailyNote, {
          user: userFor(input.userId, trace),
          localDate: input.localDate,
          title: input.title,
          bodyText: input.bodyText,
          ...(input.bodyDocument !== undefined ? { bodyDocument: input.bodyDocument } : {}),
        }),
      ),
    getDailyNote: (input) =>
      runConvex("getDailyNote", (trace) =>
        client.query(store.getDailyNote, {
          user: userFor(input.userId, trace),
          localDate: input.localDate,
        }),
      ),
    listNoteRevisions: (input) =>
      runConvex("listNoteRevisions", (trace) =>
        client.query(store.listNoteRevisions, {
          user: userFor(input.userId, trace),
          noteId: input.noteId,
          limit: input.limit,
        }),
      ),
    upsertExtractedItem: (input) =>
      runConvex("upsertExtractedItem", (trace) =>
        client.mutation(store.upsertExtractedItem, {
          user: userFor(input.userId, trace),
          sourceRevisionId: input.sourceRevisionId,
          sourceNoteId: input.sourceNoteId,
          kind: input.kind,
          title: input.title,
          body: input.body,
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.dueAt !== undefined ? { dueAt: input.dueAt } : {}),
          ...(input.remindAt !== undefined ? { remindAt: input.remindAt } : {}),
          ...(input.eventStartsAt !== undefined ? { eventStartsAt: input.eventStartsAt } : {}),
          ...(input.eventEndsAt !== undefined ? { eventEndsAt: input.eventEndsAt } : {}),
          confidence: input.confidence,
          dedupeKey: input.dedupeKey,
          metadata: input.metadata,
        }),
      ),
    updateExtractedItemStatus: (input) =>
      runConvex("updateExtractedItemStatus", (trace) =>
        client.mutation(store.updateExtractedItemStatus, {
          user: userFor(input.userId, trace),
          itemId: input.itemId,
          status: input.status,
        }),
      ),
    listExtractedItems: (input) =>
      runConvex("listExtractedItems", (trace) =>
        client.query(store.listExtractedItems, {
          user: userFor(input.userId, trace),
          limit: input.limit,
          ...(input.status !== undefined ? { status: input.status } : {}),
        }),
      ),
    recordItemEvent: (input) =>
      runConvex("recordItemEvent", (trace) =>
        client.mutation(store.recordItemEvent, {
          user: userFor(input.userId, trace),
          itemId: input.itemId,
          eventType: input.eventType,
          payload: input.payload,
        }),
      ),
    upsertSummaryDocument: (input) =>
      runConvex("upsertSummaryDocument", (trace) =>
        client.mutation(store.upsertSummaryDocument, {
          user: userFor(input.userId, trace),
          periodType: input.periodType,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          title: input.title,
          body: input.body,
          status: input.status,
          sourceNoteIds: [...input.sourceNoteIds],
          sourceItemIds: [...input.sourceItemIds],
          metadata: input.metadata,
        }),
      ),
    listSummaryDocuments: (input) =>
      runConvex("listSummaryDocuments", (trace) =>
        client.query(store.listSummaryDocuments, {
          user: userFor(input.userId, trace),
          limit: input.limit,
          ...(input.periodType !== undefined ? { periodType: input.periodType } : {}),
        }),
      ),
    startAgentRun: (input) =>
      runConvex("startAgentRun", (trace) =>
        client.mutation(store.startAgentRun, {
          user: userFor(input.userId, trace),
          triggerType: input.triggerType,
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.model !== undefined ? { model: input.model } : {}),
          metadata: input.metadata,
        }),
      ),
    getAgentRun: (input) =>
      runConvex("getAgentRun", (trace) =>
        client.query(store.getAgentRun, {
          user: userFor(input.userId, trace),
          runId: input.runId,
        }),
      ),
    listAgentRuns: (input) =>
      runConvex("listAgentRuns", (trace) =>
        client.query(store.listAgentRuns, {
          user: userFor(input.userId, trace),
          limit: input.limit,
          ...(input.sourceType !== undefined ? { sourceType: input.sourceType } : {}),
        }),
      ),
    markAgentRunRunning: (input) =>
      runConvex("markAgentRunRunning", (trace) =>
        client.mutation(store.markAgentRunRunning, {
          user: userFor(input.userId, trace),
          runId: input.runId,
        }),
      ),
    completeAgentRun: (input) =>
      runConvex("completeAgentRun", (trace) =>
        client.mutation(store.completeAgentRun, {
          user: userFor(input.userId, trace),
          runId: input.runId,
          status: input.status,
          ...(input.errorCode !== undefined ? { errorCode: input.errorCode } : {}),
          ...(input.outputs !== undefined ? { outputs: [...input.outputs] } : {}),
        }),
      ),
    upsertJournalDocument: (input) =>
      runConvex("upsertJournalDocument", (trace) =>
        client.mutation(store.upsertJournalDocument, {
          user: userFor(input.userId, trace),
          localDate: input.localDate,
          title: input.title,
          bodyText: input.bodyText,
          ...(input.bodyDocument !== undefined ? { bodyDocument: input.bodyDocument } : {}),
        }),
      ),
    getJournalDocument: (input) =>
      runConvex("getJournalDocument", (trace) =>
        client.query(store.getJournalDocument, {
          user: userFor(input.userId, trace),
          localDate: input.localDate,
        }),
      ),
    listJournalDocuments: (input) =>
      runConvex("listJournalDocuments", (trace) =>
        client.query(store.listJournalDocuments, { user: userFor(input.userId, trace) }),
      ),
    listJournalRevisions: (input) =>
      runConvex("listJournalRevisions", (trace) =>
        client.query(store.listJournalRevisions, {
          user: userFor(input.userId, trace),
          documentId: input.documentId,
          limit: input.limit,
        }),
      ),
    upsertMemoryDocument: (input) =>
      runConvex("upsertMemoryDocument", (trace) =>
        client.mutation(store.upsertMemoryDocument, {
          user: userFor(input.userId, trace),
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          title: input.title,
          bodyText: input.bodyText,
          ...(input.localDate !== undefined ? { localDate: input.localDate } : {}),
        }),
      ),
    getMemoryChunk: (input) =>
      runConvex("getMemoryChunk", (trace) =>
        client.query(store.getMemoryChunk, {
          user: userFor(input.userId, trace),
          memoryChunkId: input.memoryChunkId,
        }),
      ),
    listMemoryChunks: (input) =>
      runConvex("listMemoryChunks", (trace) =>
        client.query(store.listMemoryChunks, {
          user: userFor(input.userId, trace),
          memoryDocumentId: input.memoryDocumentId,
        }),
      ),
    listPendingMemoryIndexJobs: (input) =>
      runConvex("listPendingMemoryIndexJobs", (trace) =>
        client.query(store.listPendingMemoryIndexJobs, {
          user: userFor(input.userId, trace),
          limit: input.limit,
        }),
      ),
    markMemoryChunkIndexed: (input) =>
      runConvex("markMemoryChunkIndexed", (trace) =>
        client.mutation(store.markMemoryChunkIndexed, {
          user: userFor(input.userId, trace),
          memoryChunkId: input.memoryChunkId,
        }),
      ),
    recordMemoryRetrieval: (input) =>
      runConvex("recordMemoryRetrieval", (trace) =>
        client.mutation(store.recordMemoryRetrieval, {
          user: userFor(input.userId, trace),
          query: input.query,
          resultChunkIds: [...input.resultChunkIds],
          source: input.source,
        }),
      ),
  };
}
