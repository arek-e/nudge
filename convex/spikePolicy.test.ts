import { describe, expect, test } from "bun:test";
import { applyDailyNotePatch, idempotencyConflict, sameMutationReplay } from "./spikePolicy";

describe("Convex daily note spike policy", () => {
  test("creates a revision when there is no existing document", () => {
    const applied = applyDailyNotePatch({
      existing: null,
      input: {
        bodyDocument: [{ children: [{ text: "First note" }], type: "p" }],
        bodyText: "First note",
        title: "2026-07-01",
      },
      now: "2026-07-01T10:00:00.000Z",
    });

    expect(applied.bodyText).toBe("First note");
    expect(applied.serverRevision).toBe("1");
    expect(applied.updatedAt).toBe("2026-07-01T10:00:00.000Z");
  });

  test("increments a numeric server revision on update", () => {
    const applied = applyDailyNotePatch({
      existing: {
        bodyDocument: undefined,
        bodyText: "First note",
        serverRevision: "7",
        title: "2026-07-01",
      },
      input: {
        bodyDocument: undefined,
        bodyText: "Updated note",
        title: "2026-07-01",
      },
      now: "2026-07-01T10:05:00.000Z",
    });

    expect(applied.bodyText).toBe("Updated note");
    expect(applied.serverRevision).toBe("8");
  });

  test("detects mutation replay and conflicting idempotency keys", () => {
    const existingMutation = {
      payloadHash: "hash-a",
      status: "accepted" as const,
    };

    expect(sameMutationReplay(existingMutation, "hash-a")).toBe(true);
    expect(sameMutationReplay(existingMutation, "hash-b")).toBe(false);
    expect(idempotencyConflict(existingMutation, "hash-b")).toEqual({
      code: "idempotency_conflict",
      existingPayloadHash: "hash-a",
    });
  });
});
