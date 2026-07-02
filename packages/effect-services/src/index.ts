import { Context, Effect, Layer } from "effect";
import { Db, type DbUser, type MemoryChunkRecord, type ReviewDecision } from "@nudge/db";
import {
  buildDeterministicProposals,
  buildDeterministicSynthesis,
  defaultFrame,
} from "@nudge/domain";

export * from "./okf";
export * from "./agent-prompts";

export interface DurableWorkflowStepConfig<Timeout extends number | string = number | string> {
  readonly retries?: {
    readonly limit: number;
    readonly delay: number | string;
    readonly backoff?: "constant" | "linear" | "exponential";
  };
  readonly timeout?: Timeout;
  readonly sensitive?: "output";
}

export const durableWorkflowStepConfig = {
  retries: {
    limit: 5,
    delay: 1_000,
    backoff: "exponential",
  },
  timeout: "10 minutes",
} satisfies DurableWorkflowStepConfig<"10 minutes">;

export const currentWorkflowVersion = 1;

export type WorkflowVersion = typeof currentWorkflowVersion;

export const workflowStepName = (version: WorkflowVersion, name: string) => `v${version}.${name}`;

export interface MemorySearchResult {
  readonly chunkId: string;
  readonly score: number;
  readonly sourceType: MemoryChunkRecord["sourceType"];
  readonly sourceId: string;
  readonly text: string;
}

export interface TurbopufferMemoryIndexConfig {
  readonly apiKey: string;
  readonly fetch?: typeof globalThis.fetch;
  readonly region: string;
}

interface TurbopufferQueryRow {
  readonly $dist?: number;
  readonly id: string;
  readonly source_id?: string;
  readonly source_type?: MemoryChunkRecord["sourceType"];
  readonly text?: string;
}

const sha256Hex = (value: string) =>
  Effect.promise(async () => {
    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  });

const memoryNamespaceForUser = (userId: string) =>
  Effect.map(sha256Hex(userId), (hash) => `nudge-user-${hash.slice(0, 48)}`);

const turbopufferUrl = (config: TurbopufferMemoryIndexConfig, namespace: string, path = "") =>
  `https://${config.region}.turbopuffer.com/v2/namespaces/${namespace}${path}`;

const turbopufferFetchJson = (config: TurbopufferMemoryIndexConfig, url: string, body: unknown) =>
  Effect.tryPromise({
    try: async () => {
      const response = await (config.fetch ?? globalThis.fetch)(url, {
        body: JSON.stringify(body),
        headers: {
          authorization: `Bearer ${config.apiKey}`,
          "content-type": "application/json",
        },
        method: "POST",
      });
      if (!response.ok) throw new Error(`Turbopuffer request failed with ${response.status}`);
      return await response.json();
    },
    catch: (error) => (error instanceof Error ? error : new Error("Turbopuffer request failed")),
  });

function readObjectProperty(value: unknown, key: string) {
  return typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined;
}

function readStringProperty(value: unknown, key: string) {
  const property = readObjectProperty(value, key);
  return typeof property === "string" ? property : undefined;
}

function readNumberProperty(value: unknown, key: string) {
  const property = readObjectProperty(value, key);
  return typeof property === "number" ? property : undefined;
}

function turbopufferSourceTypeFrom(value: string): MemoryChunkRecord["sourceType"] {
  switch (value) {
    case "daily_note":
      return "daily_note";
    case "note_revision":
      return "note_revision";
    case "extracted_item":
      return "extracted_item";
    case "summary":
      return "summary";
    case "journal_document":
      return "journal_document";
    case "journal_revision":
      return "journal_revision";
    case "signal":
      return "signal";
    case "proposal":
      return "proposal";
    case "commitment":
      return "commitment";
    default:
      throw new Error(`Invalid Turbopuffer source type: ${value}`);
  }
}

function turbopufferQueryRowFrom(value: unknown): ReadonlyArray<TurbopufferQueryRow> {
  const id = readStringProperty(value, "id");
  if (!id) return [];
  const distance = readNumberProperty(value, "$dist");
  const sourceId = readStringProperty(value, "source_id");
  const sourceType = readStringProperty(value, "source_type");
  const text = readStringProperty(value, "text");
  return [
    {
      id,
      ...(distance !== undefined ? { $dist: distance } : {}),
      ...(sourceId ? { source_id: sourceId } : {}),
      ...(sourceType ? { source_type: turbopufferSourceTypeFrom(sourceType) } : {}),
      ...(text ? { text } : {}),
    },
  ];
}

function turbopufferQueryRowsFrom(value: unknown) {
  const rows = readObjectProperty(value, "rows");
  return Array.isArray(rows) ? rows.flatMap(turbopufferQueryRowFrom) : [];
}

const turbopufferDelete = (config: TurbopufferMemoryIndexConfig, url: string) =>
  Effect.tryPromise({
    try: async () => {
      const response = await (config.fetch ?? globalThis.fetch)(url, {
        headers: { authorization: `Bearer ${config.apiKey}` },
        method: "DELETE",
      });
      if (!response.ok && response.status !== 404) {
        throw new Error(`Turbopuffer delete failed with ${response.status}`);
      }
    },
    catch: (error) => (error instanceof Error ? error : new Error("Turbopuffer delete failed")),
  });

const tokenizeMemoryQuery = (text: string) =>
  text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 0);

const scoreMemoryChunk = (queryTokens: ReadonlyArray<string>, chunk: MemoryChunkRecord) => {
  const chunkText = chunk.chunkText.toLowerCase();
  return queryTokens.reduce((score, token) => score + (chunkText.includes(token) ? 1 : 0), 0);
};

export class MemoryIndex extends Context.Service<
  MemoryIndex,
  {
    readonly indexPending: (input: {
      readonly user: DbUser;
      readonly limit: number;
    }) => Effect.Effect<{ readonly indexedChunkIds: ReadonlyArray<string> }, Error, Db>;
    readonly retrieve: (input: {
      readonly user: DbUser;
      readonly query: string;
      readonly limit: number;
    }) => Effect.Effect<{ readonly results: ReadonlyArray<MemorySearchResult> }, Error, Db>;
    readonly deleteUserNamespace: (input: { readonly user: DbUser }) => Effect.Effect<void, Error>;
  }
>()("nudge/MemoryIndex") {
  static readonly layerMemory = Layer.succeed(MemoryIndex)({
    deleteUserNamespace: () => Effect.void,
    indexPending: (input) =>
      Effect.gen(function* () {
        const db = yield* Db;
        yield* db.ensureUser(input.user);
        const jobs = yield* db.listPendingMemoryIndexJobs({
          limit: input.limit,
          userId: input.user.id,
        });
        const indexedChunkIds = [];
        for (const job of jobs) {
          const chunk = yield* db.getMemoryChunk({
            memoryChunkId: job.memoryChunkId,
            userId: input.user.id,
          });
          if (!chunk) continue;
          yield* db.markMemoryChunkIndexed({
            memoryChunkId: chunk.id,
            userId: input.user.id,
          });
          indexedChunkIds.push(chunk.id);
        }
        return { indexedChunkIds };
      }),
    retrieve: (input) =>
      Effect.gen(function* () {
        const db = yield* Db;
        yield* db.ensureUser(input.user);
        const exported = yield* db.exportUserData(input.user);
        const queryTokens = tokenizeMemoryQuery(input.query);
        const results = exported.memoryChunks
          .filter((chunk) => chunk.indexedAt !== undefined)
          .map((chunk) => ({ chunk, score: scoreMemoryChunk(queryTokens, chunk) }))
          .filter((result) => result.score > 0)
          .sort(
            (left, right) =>
              right.score - left.score || left.chunk.createdAt.localeCompare(right.chunk.createdAt),
          )
          .slice(0, input.limit)
          .map(({ chunk, score }) => ({
            chunkId: chunk.id,
            score,
            sourceId: chunk.sourceId,
            sourceType: chunk.sourceType,
            text: chunk.chunkText,
          }));

        yield* db.recordMemoryRetrieval({
          query: input.query,
          resultChunkIds: results.map((result) => result.chunkId),
          source: "memory-index.memory",
          userId: input.user.id,
        });

        return { results };
      }),
  });

  static readonly layerTurbopuffer = (config: TurbopufferMemoryIndexConfig) =>
    Layer.succeed(MemoryIndex)({
      deleteUserNamespace: (input) =>
        Effect.gen(function* () {
          const namespace = yield* memoryNamespaceForUser(input.user.id);
          yield* turbopufferDelete(config, turbopufferUrl(config, namespace));
        }),
      indexPending: (input) =>
        Effect.gen(function* () {
          const db = yield* Db;
          yield* db.ensureUser(input.user);
          const jobs = yield* db.listPendingMemoryIndexJobs({
            limit: input.limit,
            userId: input.user.id,
          });
          const chunks = [];
          for (const job of jobs) {
            const chunk = yield* db.getMemoryChunk({
              memoryChunkId: job.memoryChunkId,
              userId: input.user.id,
            });
            if (chunk) chunks.push(chunk);
          }
          if (chunks.length === 0) return { indexedChunkIds: [] };

          const namespace = yield* memoryNamespaceForUser(input.user.id);
          yield* turbopufferFetchJson(config, turbopufferUrl(config, namespace), {
            schema: {
              source_id: { type: "string" },
              source_type: { type: "string" },
              text: { full_text_search: true, type: "string" },
            },
            upsert_rows: chunks.map((chunk) => ({
              id: chunk.id,
              source_id: chunk.sourceId,
              source_type: chunk.sourceType,
              text: chunk.chunkText,
            })),
          });

          const indexedChunkIds = [];
          for (const chunk of chunks) {
            yield* db.markMemoryChunkIndexed({ memoryChunkId: chunk.id, userId: input.user.id });
            indexedChunkIds.push(chunk.id);
          }
          return { indexedChunkIds };
        }),
      retrieve: (input) =>
        Effect.gen(function* () {
          const db = yield* Db;
          yield* db.ensureUser(input.user);
          const namespace = yield* memoryNamespaceForUser(input.user.id);
          const response = yield* turbopufferFetchJson(
            config,
            turbopufferUrl(config, namespace, "/query"),
            {
              include_attributes: ["text", "source_type", "source_id"],
              limit: input.limit,
              rank_by: ["text", "BM25", input.query],
            },
          );
          const results = turbopufferQueryRowsFrom(response).flatMap((row) => {
            if (!row.text || !row.source_id || !row.source_type) return [];
            return [
              {
                chunkId: row.id,
                score: row.$dist ?? 0,
                sourceId: row.source_id,
                sourceType: row.source_type,
                text: row.text,
              },
            ];
          });
          yield* db.recordMemoryRetrieval({
            query: input.query,
            resultChunkIds: results.map((result) => result.chunkId),
            source: "memory-index.turbopuffer",
            userId: input.user.id,
          });
          return { results };
        }),
    });
}

const ensureCurrentFrame = (userId: string, key: string) =>
  Effect.gen(function* () {
    const db = yield* Db;
    const current = yield* db.getCurrentFrame({ userId, key });
    if (current) return current;
    return yield* db.upsertCurrentFrame(defaultFrame(userId, key));
  });

export const PrimitiveWorkflows = {
  appendSignal: (input: {
    readonly user: DbUser;
    readonly type: string;
    readonly source: string;
    readonly occurredAt: string;
    readonly schemaVersion: number;
    readonly idempotencyKey?: string;
    readonly payload: unknown;
  }) =>
    Effect.gen(function* () {
      const db = yield* Db;
      yield* db.ensureUser(input.user);
      return yield* db.appendEvent({
        occurredAt: input.occurredAt,
        payload: input.payload,
        schemaVersion: input.schemaVersion,
        source: input.source,
        type: input.type,
        userId: input.user.id,
        ...(input.idempotencyKey !== undefined ? { idempotencyKey: input.idempotencyKey } : {}),
      });
    }),

  listSignals: (input: {
    readonly user: DbUser;
    readonly limit: number;
    readonly from?: string;
    readonly to?: string;
  }) =>
    Effect.gen(function* () {
      const db = yield* Db;
      yield* db.ensureUser(input.user);
      return yield* db.listRecentEvents({
        limit: input.limit,
        ...(input.from ? { occurredFrom: input.from } : {}),
        ...(input.to ? { occurredTo: input.to } : {}),
        userId: input.user.id,
      });
    }),

  createSynthesis: (input: { readonly user: DbUser; readonly frameKey: string }) =>
    Effect.gen(function* () {
      const db = yield* Db;
      yield* db.ensureUser(input.user);
      const frame = yield* db.upsertCurrentFrame(defaultFrame(input.user.id, input.frameKey));
      const signals = yield* db.listRecentEvents({ userId: input.user.id, limit: 20 });
      const synthesis = yield* db.appendSynthesis(
        buildDeterministicSynthesis({ userId: input.user.id, frameId: frame.id, signals }),
      );
      return { frame, synthesis };
    }),

  latestSynthesis: (input: { readonly user: DbUser; readonly frameKey: string }) =>
    Effect.gen(function* () {
      const db = yield* Db;
      yield* db.ensureUser(input.user);
      const frame = yield* ensureCurrentFrame(input.user.id, input.frameKey);
      const latest = yield* db.getLatestSynthesis({ userId: input.user.id, frameId: frame.id });
      if (latest) return { frame, synthesis: latest };

      const signals = yield* db.listRecentEvents({ userId: input.user.id, limit: 20 });
      const synthesis = yield* db.appendSynthesis(
        buildDeterministicSynthesis({ userId: input.user.id, frameId: frame.id, signals }),
      );
      return { frame, synthesis };
    }),

  generateProposals: (input: { readonly user: DbUser; readonly frameKey: string }) =>
    Effect.gen(function* () {
      const db = yield* Db;
      yield* db.ensureUser(input.user);
      const frame = yield* ensureCurrentFrame(input.user.id, input.frameKey);
      const synthesis = yield* db.getLatestSynthesis({ userId: input.user.id, frameId: frame.id });
      if (!synthesis) return [];

      const proposalInputs = buildDeterministicProposals({
        openQuestions: synthesis.openQuestions,
        synthesisId: synthesis.id,
        themes: synthesis.themes,
        userId: input.user.id,
      });
      const created = [];
      for (const proposalInput of proposalInputs) {
        created.push(yield* db.appendProposal(proposalInput));
      }
      return created;
    }),

  listPendingProposals: (input: { readonly user: DbUser; readonly limit: number }) =>
    Effect.gen(function* () {
      const db = yield* Db;
      yield* db.ensureUser(input.user);
      return yield* db.listPendingProposals({ userId: input.user.id, limit: input.limit });
    }),

  reviewProposal: (input: {
    readonly user: DbUser;
    readonly proposalId: string;
    readonly decision: ReviewDecision;
    readonly editedTitle?: string;
    readonly editedBody?: string;
    readonly editedBodyDocument?: unknown;
  }) =>
    Effect.gen(function* () {
      const db = yield* Db;
      yield* db.ensureUser(input.user);
      const proposal = yield* db.getProposal({
        proposalId: input.proposalId,
        userId: input.user.id,
      });
      if (!proposal) return yield* Effect.fail(new Error("Proposal not found"));

      if (proposal.status !== "pending") {
        const existingReview = yield* db.getReviewForProposal({
          proposalId: input.proposalId,
          userId: input.user.id,
        });
        if (
          existingReview?.decision === input.decision &&
          existingReview.editedTitle === input.editedTitle &&
          existingReview.editedBody === input.editedBody &&
          JSON.stringify(existingReview.editedBodyDocument) ===
            JSON.stringify(input.editedBodyDocument)
        ) {
          return existingReview;
        }
        return yield* Effect.fail(new Error("Proposal already reviewed"));
      }

      const review = yield* db.reviewProposal({
        decision: input.decision,
        ...(input.editedTitle !== undefined ? { editedTitle: input.editedTitle } : {}),
        ...(input.editedBody !== undefined ? { editedBody: input.editedBody } : {}),
        ...(input.editedBodyDocument !== undefined
          ? { editedBodyDocument: input.editedBodyDocument }
          : {}),
        proposalId: input.proposalId,
        userId: input.user.id,
      });

      if (input.decision !== "rejected") {
        yield* db.appendCommitment({
          body: input.editedBody ?? proposal.body,
          ...(input.editedBodyDocument !== undefined
            ? { bodyDocument: input.editedBodyDocument }
            : {}),
          proposalId: proposal.id,
          reviewId: review.id,
          title: input.editedTitle ?? proposal.title,
          userId: input.user.id,
        });
      }

      return review;
    }),

  listCommitments: (input: { readonly user: DbUser; readonly limit: number }) =>
    Effect.gen(function* () {
      const db = yield* Db;
      yield* db.ensureUser(input.user);
      return yield* db.listCommitments({
        limit: input.limit,
        status: "active",
        userId: input.user.id,
      });
    }),

  recordOutcome: (input: {
    readonly user: DbUser;
    readonly commitmentId: string;
    readonly result: "completed" | "abandoned";
    readonly note?: string;
  }) =>
    Effect.gen(function* () {
      const db = yield* Db;
      yield* db.ensureUser(input.user);
      return yield* db.recordOutcome({
        commitmentId: input.commitmentId,
        ...(input.note !== undefined ? { note: input.note } : {}),
        result: input.result,
        userId: input.user.id,
      });
    }),

  listOutcomes: (input: { readonly user: DbUser; readonly limit: number }) =>
    Effect.gen(function* () {
      const db = yield* Db;
      yield* db.ensureUser(input.user);
      return yield* db.listOutcomes({
        limit: input.limit,
        userId: input.user.id,
      });
    }),
};
