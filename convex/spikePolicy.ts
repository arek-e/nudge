export interface DailyNotePatchInput {
  readonly bodyDocument: unknown | undefined;
  readonly bodyText: string;
  readonly title: string;
}

export interface ExistingDailyNote {
  readonly bodyDocument: unknown | undefined;
  readonly bodyText: string;
  readonly serverRevision: string;
  readonly title: string;
}

export interface AppliedDailyNotePatch {
  readonly bodyDocument: unknown | undefined;
  readonly bodyText: string;
  readonly serverRevision: string;
  readonly title: string;
  readonly updatedAt: string;
}

export interface ExistingMutationReceipt {
  readonly payloadHash: string;
  readonly status: "accepted";
}

export function applyDailyNotePatch(input: {
  readonly existing: ExistingDailyNote | null;
  readonly input: DailyNotePatchInput;
  readonly now: string;
}): AppliedDailyNotePatch {
  const previousRevision = input.existing ? Number(input.existing.serverRevision) : 0;
  const nextRevision = Number.isFinite(previousRevision) ? previousRevision + 1 : 1;
  return {
    bodyDocument: input.input.bodyDocument,
    bodyText: input.input.bodyText,
    serverRevision: String(nextRevision),
    title: input.input.title,
    updatedAt: input.now,
  };
}

export function sameMutationReplay(existing: ExistingMutationReceipt | null, payloadHash: string) {
  return existing !== null && existing.payloadHash === payloadHash;
}

export function idempotencyConflict(existing: ExistingMutationReceipt, payloadHash: string) {
  return existing.payloadHash === payloadHash
    ? null
    : { code: "idempotency_conflict", existingPayloadHash: existing.payloadHash };
}
