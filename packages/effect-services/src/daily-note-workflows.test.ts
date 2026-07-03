import { describe, expect, test } from "bun:test";
import { Effect } from "effect";
import { Db } from "@nudge/db";
import { NoteAnalysisWorkflows } from "./index";

const user = { id: "daily-note-workflow-user", displayName: "Workflow User" };

const runWithMemoryDb = <A, E>(workflow: Effect.Effect<A, E, Db>) => {
  return Effect.runPromise(Effect.provide(workflow, Db.layerMemory));
};

describe("NoteAnalysisWorkflows", () => {
  test("saves journal text through the shared Engine workflow and queues analysis", async () => {
    const scheduledParams = [];
    const result = await runWithMemoryDb(
      NoteAnalysisWorkflows.saveJournalCapture({
        aiModel: "@cf/meta/llama",
        bodyText: "Follow up with Mara about launch tomorrow.",
        localDate: "2026-07-03",
        requestId: "request-1",
        scheduleAnalysis: (input) =>
          Effect.sync(() => {
            scheduledParams.push(input.params);
          }),
        title: "Today",
        traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00",
        user,
      }),
    );

    expect(result.document.bodyText).toBe("Follow up with Mara about launch tomorrow.");
    expect(result.analysisRun?.sourceType).toBe("note_revision");
    expect(result.analysisRun?.sourceId).toBe(result.dailyNote.revision.id);
    expect(result.wideEvent).toEqual({
      aiErrorCode: null,
      aiModel: "@cf/meta/llama",
      aiRunId: result.analysisRun?.id,
      aiSourceType: "note_revision",
      aiSystem: "cloudflare-think",
      noteLocalDate: "2026-07-03",
    });
    expect(scheduledParams).toHaveLength(1);
    expect(scheduledParams[0]).toEqual({
      changedText: "Follow up with Mara about launch tomorrow.",
      documentId: result.document.id,
      kind: "daily-note-analysis",
      localDate: "2026-07-03",
      noteId: result.dailyNote.note.id,
      requestId: "request-1",
      revisionId: result.dailyNote.revision.id,
      runId: result.analysisRun?.id,
      title: "Today",
      traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00",
      userDisplayName: "Workflow User",
      userId: "daily-note-workflow-user",
      workflowVersion: 1,
    });
  });

  test("does not queue analysis when the save has no text delta", async () => {
    const result = await runWithMemoryDb(
      Effect.gen(function* () {
        yield* NoteAnalysisWorkflows.saveJournalCapture({
          aiModel: "@cf/meta/llama",
          bodyText: "Same note",
          localDate: "2026-07-03",
          title: "Today",
          user,
        });
        return yield* NoteAnalysisWorkflows.saveJournalCapture({
          aiModel: "@cf/meta/llama",
          bodyText: "Same note",
          localDate: "2026-07-03",
          title: "Today",
          user,
        });
      }),
    );

    expect(result.analysisRun).toBeUndefined();
    expect(result.wideEvent).toBeUndefined();
  });

  test("persists daily note analysis output through the shared Engine workflow", async () => {
    const result = await runWithMemoryDb(
      Effect.gen(function* () {
        const saved = yield* NoteAnalysisWorkflows.saveJournalCapture({
          aiModel: "@cf/meta/llama",
          bodyText: "Book train tickets and remember Mara prefers morning reviews.",
          localDate: "2026-07-03",
          title: "Today",
          user,
        });
        if (!saved.analysisRun) throw new Error("Expected analysis run");

        const persisted = yield* NoteAnalysisWorkflows.persistAnalysisResults({
          changedText: "Book train tickets and remember Mara prefers morning reviews.",
          extraction: {
            items: [
              {
                body: "Book train tickets before Friday.",
                confidence: 0.91,
                kind: "task",
                title: "Book train tickets",
              },
              {
                body: "Mara prefers morning reviews.",
                kind: "memory",
                title: "Mara review preference",
              },
            ],
            model: "@cf/meta/llama",
            provider: "cloudflare-think",
          },
          localDate: "2026-07-03",
          noteId: saved.dailyNote.note.id,
          revisionId: saved.dailyNote.revision.id,
          runId: saved.analysisRun.id,
          userId: user.id,
        });
        const db = yield* Db;
        const exported = yield* db.exportUserData(user);

        return { exported, persisted };
      }),
    );

    expect(result.persisted.itemCount).toBe(2);
    expect(result.persisted.dailySummary.periodType).toBe("day");
    expect(result.persisted.weeklySummary.periodType).toBe("week");
    expect(result.exported.extractedItems.map((item) => item.title)).toEqual([
      "Book train tickets",
      "Mara review preference",
    ]);
    expect(
      result.exported.memoryDocuments.some((memory) => memory.sourceType === "extracted_item"),
    ).toBe(true);
    expect(result.exported.agentRuns[0]?.status).toBe("completed");
    expect(result.exported.agentRunOutputs).toHaveLength(4);
  });

  test("records follow-through intent when accepting extracted reminders", async () => {
    const result = await runWithMemoryDb(
      Effect.gen(function* () {
        const db = yield* Db;
        const item = yield* db.upsertExtractedItem({
          body: "Notify me before the launch review.",
          confidence: 0.91,
          dedupeKey: "reminder:launch-review",
          kind: "reminder",
          metadata: {},
          remindAt: "2026-07-04T08:00:00.000Z",
          sourceNoteId: "note-1",
          sourceRevisionId: "revision-1",
          title: "Launch review reminder",
          userId: user.id,
        });
        const reviewed = yield* NoteAnalysisWorkflows.reviewExtractedItemStatus({
          itemId: item.id,
          status: "accepted",
          userId: user.id,
        });
        const exported = yield* db.exportUserData(user);

        return { exported, reviewed };
      }),
    );

    expect(result.reviewed.action.status).toBe("accepted");
    expect(result.reviewed.event.payload).toEqual({
      followThrough: {
        remindAt: "2026-07-04T08:00:00.000Z",
        status: "needs_adapter",
        type: "reminder",
      },
      status: "accepted",
    });
    expect(result.exported.itemEvents).toHaveLength(1);
  });
});
