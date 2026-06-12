import { Context, Effect, Layer } from "effect";
import { Db, type DbUser, type ReviewDecision } from "@lares/db";
import {
  buildDeterministicProposals,
  buildDeterministicSynthesis,
  defaultFrame,
  type DevUser,
} from "@lares/domain";

export const durableWorkflowStepConfig = {
  retries: {
    limit: 5,
    delay: 1_000,
    backoff: "exponential",
  },
  timeout: "10 minutes",
} as const;

export const currentWorkflowVersion = 1;

export type WorkflowVersion = typeof currentWorkflowVersion;

export const workflowStepName = (version: WorkflowVersion, name: string) => `v${version}.${name}`;

export class AuthService extends Context.Service<
  AuthService,
  {
    readonly currentUser: Effect.Effect<DevUser>;
  }
>()("lares/AuthService") {
  static readonly layerDev = Layer.succeed(AuthService)({
    currentUser: Effect.succeed({
      id: "dev-user",
      displayName: "Dev User",
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
          existingReview.editedBody === input.editedBody
        ) {
          return existingReview;
        }
        return yield* Effect.fail(new Error("Proposal already reviewed"));
      }

      const review = yield* db.reviewProposal({
        decision: input.decision,
        ...(input.editedTitle !== undefined ? { editedTitle: input.editedTitle } : {}),
        ...(input.editedBody !== undefined ? { editedBody: input.editedBody } : {}),
        proposalId: input.proposalId,
        userId: input.user.id,
      });

      if (input.decision !== "rejected") {
        yield* db.appendCommitment({
          body: input.editedBody ?? proposal.body,
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
};
