import { Effect } from "effect";
import type { ApiContext } from "../context";
import type { ApiAction } from "./effect-helpers";
import { readReviewInboxData } from "../db/read-review-inbox-data";
import { listReceiptResponses } from "./agent-receipts";
import {
  type ProposalExplanation,
  synthesesByIdFrom,
  toProposalWithExplanation,
} from "./proposal-explanations";

export interface ListReviewInboxInput {
  readonly context: ApiContext;
  readonly limit: number;
}

interface ReviewInboxProposal {
  readonly id: string;
  readonly userId: string;
  readonly synthesisId: string;
  readonly kind: "clarify" | "follow_up" | "commit" | "ignore";
  readonly status: "pending" | "accepted" | "edited" | "rejected";
  readonly title: string;
  readonly body: string;
  readonly rationale: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly explanation: ProposalExplanation;
}

interface ReviewInboxItem {
  readonly id: string;
  readonly createdAt: string;
  readonly kind: "proposal";
  readonly proposal: ReviewInboxProposal;
}

export interface ListReviewInboxResult {
  readonly items: ReviewInboxItem[];
  readonly receipts: ReturnType<typeof listReceiptResponses>;
}

export function listReviewInbox(input: ListReviewInboxInput): ApiAction<ListReviewInboxResult> {
  return readReviewInboxData({
    db: input.context.db,
    user: input.context.user,
  }).pipe(
    Effect.map((exported) => {
      const synthesesById = synthesesByIdFrom({ exported });
      const pendingProposals = exported.proposals
        .filter((proposal) => proposal.status === "pending")
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .slice(0, input.limit);

      return {
        items: pendingProposals.map((proposal) => {
          const item: ReviewInboxItem = {
            id: proposal.id,
            createdAt: proposal.createdAt,
            kind: "proposal",
            proposal: toProposalWithExplanation({ proposal, synthesesById }),
          };
          return item;
        }),
        receipts: listReceiptResponses({ exported, limit: input.limit }),
      };
    }),
  );
}
