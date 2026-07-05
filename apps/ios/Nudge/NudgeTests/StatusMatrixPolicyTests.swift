import GRDB
import XCTest

@testable import Nudge

final class StatusMatrixPolicyTests: XCTestCase {
    func testOfflinePendingNoteSeparatesGlobalNoteAndAIState() {
        let snapshot = SyncStatusMatrixPolicy.evaluate(
            isOnline: false,
            pendingSyncCount: 1,
            hasSyncFailure: false,
            localNoteSyncStatus: "pending_sync",
            hasJournal: true,
            stage: .queued,
            retainedRows: [
                RetainedCaptureRow(mutationId: "mutation-a", noteText: "Follow up", stage: .queued)
            ]
        )

        XCTAssertEqual(snapshot.global.title, "Offline")
        XCTAssertEqual(snapshot.note.title, "Pending sync")
        XCTAssertEqual(snapshot.ai.title, "Nudge will review this")
    }

    func testRetainedRowsMigrationDropsActiveRowsWithoutMutationIds() {
        let savedRowId = UUID()
        let mutationRowId = UUID()
        let migrated = RetainedCaptureRowsMigrationPolicy.canonicalize([
            RetainedCaptureRow(
                id: savedRowId,
                noteText: "Already saved",
                stage: .saved
            ),
            RetainedCaptureRow(
                noteText: "Old Engine-only processing row",
                stage: .processing
            ),
            RetainedCaptureRow(
                id: mutationRowId,
                mutationId: "mutation-a",
                noteText: "Convex projected row",
                stage: .queued
            )
        ])

        XCTAssertEqual(migrated.map(\.id), [savedRowId, mutationRowId])
        XCTAssertEqual(migrated.map(\.noteText), ["Already saved", "Convex projected row"])
    }

    func testDailyReviewUsesLocalProjectionAndOpenContext() {
        let snapshot = DailyReviewSnapshotPolicy.evaluate(
            localDate: "2026-07-05",
            journal: JournalDocument(
                id: "journal-1",
                localDate: "2026-07-05",
                title: "Sunday",
                bodyText: "Morning planning\n\nShipped the sync matrix",
                updatedAt: "2026-07-05T08:30:00Z"
            ),
            retainedRows: [
                RetainedCaptureRow(
                    mutationId: "mutation-a",
                    noteText: "Queued local thought",
                    stage: .queued
                )
            ],
            actions: [
                ActionItem(
                    id: "action-1",
                    kind: "follow_up",
                    title: "Email Sam",
                    body: "Send the review notes.",
                    status: "accepted",
                    confidence: 0.86,
                    createdAt: "2026-07-05T08:35:00Z",
                    updatedAt: "2026-07-05T08:35:00Z"
                ),
                ActionItem(
                    id: "action-2",
                    kind: "done",
                    title: "Archive old task",
                    body: "",
                    status: "completed",
                    confidence: 0.91,
                    createdAt: "2026-07-05T08:35:00Z",
                    updatedAt: "2026-07-05T08:35:00Z"
                )
            ],
            signals: [
                EventRecord(
                    id: "signal-1",
                    userId: "user-1",
                    type: "note",
                    source: "ios",
                    occurredAt: "2026-07-05T08:36:00Z",
                    schemaVersion: 1,
                    idempotencyKey: nil,
                    payload: .object(["note": .string("Called out the iOS projection gap")]),
                    createdAt: "2026-07-05T08:36:00Z"
                )
            ],
            syncStatus: SyncStatusMatrixPolicy.evaluate(
                isOnline: true,
                pendingSyncCount: 1,
                hasSyncFailure: false,
                localNoteSyncStatus: "pending_sync",
                hasJournal: true,
                stage: .queued,
                retainedRows: []
            )
        )

        XCTAssertEqual(snapshot.noteRows.map(\.text), [
            "Morning planning",
            "Shipped the sync matrix",
            "Queued local thought"
        ])
        XCTAssertEqual(snapshot.openActionRows.map(\.title), ["Email Sam"])
        XCTAssertEqual(snapshot.signalRows.map(\.title), ["Called out the iOS projection gap"])
        XCTAssertEqual(snapshot.metricRows.map(\.value), ["3", "1", "1", "Pending"])
    }

    func testLocalNoteStoreMigratesLegacySyncStatusesToCanonicalProjectionStates() throws {
        let dbQueue = try DatabaseQueue()
        try dbQueue.write { db in
            try db.execute(sql: """
                create table local_note_documents (
                  local_date text primary key,
                  title text not null,
                  body_text text not null,
                  server_revision text,
                  sync_status text not null,
                  updated_at text not null
                )
                """)
            try db.execute(sql: """
                create table pending_note_mutations (
                  id text primary key,
                  local_date text not null,
                  title text not null,
                  body_text text not null,
                  base_server_revision text,
                  payload_hash text not null,
                  status text not null,
                  created_at text not null,
                  last_error text
                )
                """)
            try db.execute(
                sql: """
                    insert into local_note_documents (
                      local_date, title, body_text, server_revision, sync_status, updated_at
                    ) values ('2026-07-05', 'Sunday', 'Draft body', null, 'local', '2026-07-05T08:00:00Z')
                    """
            )
            try db.execute(
                sql: """
                    insert into pending_note_mutations (
                      id, local_date, title, body_text, base_server_revision, payload_hash, status, created_at
                    ) values ('mutation-a', '2026-07-05', 'Sunday', 'Draft body', null, '10:Draft body', 'queued', '2026-07-05T08:00:00Z')
                    """
            )
        }

        let store = try LocalNoteStore(dbQueue: dbQueue)

        XCTAssertEqual(try store.dailyNote(localDate: "2026-07-05")?.syncStatus, "pending_sync")
        XCTAssertEqual(try store.pendingMutations().map(\.id), ["mutation-a"])
    }
}
