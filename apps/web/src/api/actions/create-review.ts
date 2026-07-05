import { Effect } from "effect";
import type { ReviewDecision, ReviewRecord } from "@nudge/db";
import { PrimitiveWorkflows } from "@nudge/effect-services";
import type { ApiContext } from "../context";
import { readUserDataExport } from "../db/read-user-data-export";
import { type ApiAction, runWorkflow } from "./effect-helpers";
import {
  buildProposalExplanation,
  proposalSource,
  synthesesByIdFrom,
} from "./proposal-explanations";
import { recordAgentReceipt } from "./record-agent-receipt";

export interface CreateReviewInput {
  readonly context: ApiContext;
  readonly decision: ReviewDecision;
  readonly editedBody?: string;
  readonly editedBodyDocument?: unknown;
  readonly editedTitle?: string;
  readonly proposalId: string;
}

export type CreateReviewResult = ReviewRecord;

export function createReview(input: CreateReviewInput): ApiAction<CreateReviewResult> {
  return Effect.gen(function* () {
    const exportedBeforeReview = yield* readUserDataExport({
      db: input.context.db,
      user: input.context.user,
    });
    const synthesesById = synthesesByIdFrom({ exported: exportedBeforeReview });
    const proposal = exportedBeforeReview.proposals.find(
      (candidate) => candidate.id === input.proposalId,
    );
    const explanation = proposal
      ? buildProposalExplanation({ proposal, synthesesById })
      : {
          source: proposalSource({ signalIds: [] }),
          reason: "Review decision recorded.",
          confidence: 0.5,
          nextAction: "Review saved.",
        };
    const review = yield* runWorkflow({
      workflow: PrimitiveWorkflows.reviewProposal({
        decision: input.decision,
        ...(input.editedTitle !== undefined ? { editedTitle: input.editedTitle } : {}),
        ...(input.editedBody !== undefined ? { editedBody: input.editedBody } : {}),
        ...(input.editedBodyDocument !== undefined
          ? { editedBodyDocument: input.editedBodyDocument }
          : {}),
        proposalId: input.proposalId,
        user: input.context.user,
      }),
    });
    yield* recordAgentReceipt({
      action: `review.${review.decision}`,
      changed: {
        decision: review.decision,
        proposalId: review.proposalId,
        reviewId: review.id,
      },
      context: input.context,
      idempotencyKey: `review.${review.id}`,
      signalIds: explanation.source.signalIds,
      why: explanation.reason,
    });
    return review;
  });
}
