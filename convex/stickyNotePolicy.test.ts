import { describe, expect, test } from "bun:test";
import { applyStickyNotePatch, idempotencyConflict, sameMutationReplay } from "./stickyNotePolicy";

describe("Convex sticky note policy", () => {
  test("creates a note revision from a surface create", () => {
    const applied = applyStickyNotePatch({
      existing: null,
      input: {
        bodyDocument: [{ children: [{ text: "Buy train tickets" }], type: "p" }],
        bodyText: "Buy train tickets",
        color: "yellow",
        pinned: false,
        title: "Buy train tickets",
      },
      now: "2026-07-03T10:00:00.000Z",
    });

    expect(applied.bodyText).toBe("Buy train tickets");
    expect(applied.color).toBe("yellow");
    expect(applied.pinned).toBe(false);
    expect(applied.serverRevision).toBe("1");
    expect(applied.title).toBe("Buy train tickets");
    expect(applied.updatedAt).toBe("2026-07-03T10:00:00.000Z");
  });

  test("increments a numeric server revision on surface patch", () => {
    const applied = applyStickyNotePatch({
      existing: {
        bodyDocument: undefined,
        bodyText: "Buy train tickets",
        color: "yellow",
        pinned: false,
        serverRevision: "7",
        title: "Buy train tickets",
      },
      input: {
        bodyDocument: undefined,
        bodyText: "Buy train tickets and ask Mara about seats",
        color: "green",
        pinned: true,
        title: "Travel",
      },
      now: "2026-07-03T10:05:00.000Z",
    });

    expect(applied.bodyText).toBe("Buy train tickets and ask Mara about seats");
    expect(applied.color).toBe("green");
    expect(applied.pinned).toBe(true);
    expect(applied.serverRevision).toBe("8");
    expect(applied.title).toBe("Travel");
  });

  test("keeps mutation retry behavior shared with every surface", () => {
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
