import Combine
import ClerkConvex
import ConvexMobile
import Foundation
import GRDB

enum ConvexNoteSyncConfig {
    static var deploymentURL: String {
        VestaEnvironmentConfig.current.convexDeploymentURL
    }
}

@MainActor
let nudgeConvexClient = ConvexClientWithAuth(
    deploymentUrl: ConvexNoteSyncConfig.deploymentURL,
    authProvider: ClerkConvexAuthProvider()
)

struct LocalDailyNote: Sendable {
    let localDate: String
    let title: String
    let bodyText: String
    let pendingMutationId: String?
    let serverRevision: String?
    let syncStatus: String
    let updatedAt: String
}

struct PendingNoteMutation: Sendable {
    let id: String
    let localDate: String
    let title: String
    let bodyText: String
    let baseServerRevision: String?
    let payloadHash: String
}

struct ConvexRemoteDocument: Decodable, Sendable {
    let bodyText: String
    let localDate: String
    let serverRevision: String
    let title: String
    let updatedAt: String
}

struct ConvexRemoteAgentStatus: Decodable, Sendable {
    let errorCode: String?
    let idempotencyKey: String?
    let status: String
    let updatedAt: String
}

struct ConvexDailyNoteState: Decodable, Sendable {
    let document: ConvexRemoteDocument?
    let status: ConvexRemoteAgentStatus?
    let statuses: [ConvexRemoteAgentStatus]?
}

struct ConvexPatchResponse: Decodable, Sendable {
    let document: ConvexRemoteDocument?
    let error: ConvexPatchResponseError?
    let ok: Bool
    let replayed: Bool?
    let status: String?
}

struct ConvexPatchResponseError: Decodable, Sendable {
    let code: String?
    let message: String?
    let serverRevision: String?

    var displayMessage: String {
        if let code, let message {
            return "\(code): \(message)"
        }
        if let code {
            return code
        }
        if let message {
            return message
        }
        if let serverRevision {
            return "revision_conflict: server revision \(serverRevision)"
        }
        return "unknown_convex_error"
    }
}

struct ConvexStoreUserResponse: Decodable, Sendable {
    let ok: Bool
}

struct LocalDailyNoteProjection: Sendable {
    let note: LocalDailyNote
    let agentStatuses: [ConvexRemoteAgentStatus]
}

struct NoteSyncReceipt: Equatable, Sendable {
    var acceptedCount = 0
    var attemptedCount = 0
    var failedCount = 0
    var lastErrorDescription: String?

    var hasFailures: Bool { failedCount > 0 }
}

enum NoteSyncError: LocalizedError {
    case mutationRejected(String)
    case missingAcceptedDocument
    case pendingReadFailed(String)

    var errorDescription: String? {
        switch self {
        case .mutationRejected(let message):
            "Convex rejected the note mutation: \(message)"
        case .missingAcceptedDocument:
            "Convex accepted the note mutation without returning a document."
        case .pendingReadFailed(let message):
            "Could not read pending note mutations: \(message)"
        }
    }
}

enum NoteSyncPayloadHash {
    static func make(bodyText: String) -> String {
        "\(bodyText.utf8.count):\(bodyText)"
    }
}

final class LocalNoteStore {
    private let dbQueue: DatabaseQueue

    init(dbQueue: DatabaseQueue) throws {
        self.dbQueue = dbQueue
        try migrate()
    }

    static func live() throws -> LocalNoteStore {
        let supportDirectory = try FileManager.default.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        )
        let directory = supportDirectory.appendingPathComponent("Nudge", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let databaseURL = directory.appendingPathComponent("notes-sync.sqlite", isDirectory: false)
        return try LocalNoteStore(
            dbQueue: DatabaseQueue(path: databaseURL.path(percentEncoded: false))
        )
    }

    private func migrate() throws {
        try dbQueue.write { db in
            try db.execute(sql: """
                create table if not exists local_note_documents (
                  local_date text primary key,
                  title text not null,
                  body_text text not null,
                  server_revision text,
                  sync_status text not null,
                  updated_at text not null
                )
                """)
            try db.execute(sql: """
                create table if not exists pending_note_mutations (
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
        }
    }

    func saveLocalDraft(localDate: String, title: String, bodyText: String) throws -> LocalDailyNote {
        let now = ISO8601DateFormatter().string(from: Date())
        let mutationId = UUID().uuidString
        let payloadHash = NoteSyncPayloadHash.make(bodyText: bodyText)
        let existingRevision = try dbQueue.read { db -> String? in
            try String.fetchOne(
                db,
                sql: "select server_revision from local_note_documents where local_date = ?",
                arguments: [localDate]
            )
        }

        try dbQueue.write { db in
            try db.execute(
                sql: """
                    insert into local_note_documents (
                      local_date, title, body_text, server_revision, sync_status, updated_at
                    ) values (?, ?, ?, ?, 'pending_sync', ?)
                    on conflict(local_date) do update set
                      title = excluded.title,
                      body_text = excluded.body_text,
                      sync_status = 'pending_sync',
                      updated_at = excluded.updated_at
                    """,
                arguments: [localDate, title, bodyText, existingRevision, now]
            )
            try db.execute(
                sql: """
                    insert into pending_note_mutations (
                      id, local_date, title, body_text, base_server_revision, payload_hash, status, created_at
                    ) values (?, ?, ?, ?, ?, ?, 'pending', ?)
                    """,
                arguments: [mutationId, localDate, title, bodyText, existingRevision, payloadHash, now]
            )
        }

        return LocalDailyNote(
            localDate: localDate,
            title: title,
            bodyText: bodyText,
            pendingMutationId: mutationId,
            serverRevision: existingRevision,
            syncStatus: "pending_sync",
            updatedAt: now
        )
    }

    func dailyNote(localDate: String) throws -> LocalDailyNote? {
        try dbQueue.read { db in
            guard let row = try Row.fetchOne(
                db,
                sql: """
                    select local_date, title, body_text, server_revision, sync_status, updated_at
                    from local_note_documents
                    where local_date = ?
                    """,
                arguments: [localDate]
            ) else {
                return nil
            }

            return LocalDailyNote(
                localDate: row["local_date"],
                title: row["title"],
                bodyText: row["body_text"],
                pendingMutationId: nil,
                serverRevision: row["server_revision"],
                syncStatus: row["sync_status"],
                updatedAt: row["updated_at"]
            )
        }
    }

    func pendingMutations() throws -> [PendingNoteMutation] {
        try dbQueue.read { db in
            let rows = try Row.fetchAll(
                db,
                sql: """
                    select id, local_date, title, body_text, base_server_revision, payload_hash
                    from pending_note_mutations
                    where status = 'pending'
                    order by created_at asc
                    """
            )
            return rows.map { row in
                PendingNoteMutation(
                    id: row["id"],
                    localDate: row["local_date"],
                    title: row["title"],
                    bodyText: row["body_text"],
                    baseServerRevision: row["base_server_revision"],
                    payloadHash: row["payload_hash"]
                )
            }
        }
    }

    func applyRemoteDocument(_ document: ConvexRemoteDocument) throws -> LocalDailyNote? {
        try dbQueue.write { db in
            let pendingCount = try Int.fetchOne(
                db,
                sql: "select count(*) from pending_note_mutations where local_date = ? and status = 'pending'",
                arguments: [document.localDate]
            ) ?? 0
            guard pendingCount == 0 else { return nil }

            try db.execute(
                sql: """
                    insert into local_note_documents (
                      local_date, title, body_text, server_revision, sync_status, updated_at
                    ) values (?, ?, ?, ?, 'synced', ?)
                    on conflict(local_date) do update set
                      title = excluded.title,
                      body_text = excluded.body_text,
                      server_revision = excluded.server_revision,
                      sync_status = 'synced',
                      updated_at = excluded.updated_at
                    """,
                arguments: [
                    document.localDate,
                    document.title,
                    document.bodyText,
                    document.serverRevision,
                    document.updatedAt
                ]
            )

            return LocalDailyNote(
                localDate: document.localDate,
                title: document.title,
                bodyText: document.bodyText,
                pendingMutationId: nil,
                serverRevision: document.serverRevision,
                syncStatus: "synced",
                updatedAt: document.updatedAt
            )
        }
    }

    func markSynced(mutation: PendingNoteMutation, document: ConvexRemoteDocument) throws {
        try dbQueue.write { db in
            try db.execute(
                sql: "update pending_note_mutations set status = 'accepted' where id = ?",
                arguments: [mutation.id]
            )
            try db.execute(
                sql: """
                    update local_note_documents
                    set server_revision = ?, sync_status = 'synced', updated_at = ?
                    where local_date = ?
                    """,
                arguments: [document.serverRevision, document.updatedAt, mutation.localDate]
            )
        }
    }

    func markFailed(mutation: PendingNoteMutation, error: Error) throws {
        try dbQueue.write { db in
            try db.execute(
                sql: """
                    update pending_note_mutations
                    set status = 'pending', last_error = ?
                    where id = ?
                    """,
                arguments: [error.localizedDescription, mutation.id]
            )
        }
    }
}

@MainActor
final class ConvexNoteClient {
    private let client: ConvexClientWithAuth<String>

    init(client: ConvexClientWithAuth<String>) {
        self.client = client
    }

    func patchDailyNote(_ mutation: PendingNoteMutation) async throws -> ConvexPatchResponse {
        var args: [String: ConvexEncodable?] = [
            "bodyText": mutation.bodyText,
            "idempotencyKey": mutation.id,
            "localDate": mutation.localDate,
            "payloadHash": mutation.payloadHash,
            "title": mutation.title
        ]
        if let baseServerRevision = mutation.baseServerRevision {
            args["baseServerRevision"] = baseServerRevision
        }
        return try await client.mutation("documents:patchDailyNote", with: args)
    }

    func dailyNotePublisher(localDate: String) -> AnyPublisher<ConvexDailyNoteState, ClientError> {
        client.subscribe(
            to: "documents:getDailyNote",
            with: ["localDate": localDate],
            yielding: ConvexDailyNoteState.self
        )
    }
}

typealias RemoteDailyNoteProjectionHandler = @MainActor @Sendable (LocalDailyNoteProjection) -> Void

actor NoteSyncCoordinator {
    private let client: ConvexNoteClient
    private let store: LocalNoteStore
    private var projectionTask: Task<Void, Never>?

    init(store: LocalNoteStore, client: ConvexNoteClient) {
        self.store = store
        self.client = client
    }

    func saveLocalDraft(localDate: String, title: String, bodyText: String) throws -> LocalDailyNote {
        try store.saveLocalDraft(localDate: localDate, title: title, bodyText: bodyText)
    }

    func localDailyNote(localDate: String) -> LocalDailyNote? {
        try? store.dailyNote(localDate: localDate)
    }

    func syncPending() async -> NoteSyncReceipt {
        let pending: [PendingNoteMutation]
        do {
            pending = try store.pendingMutations()
        } catch {
            return NoteSyncReceipt(
                failedCount: 1,
                lastErrorDescription: NoteSyncError.pendingReadFailed(error.localizedDescription)
                    .localizedDescription
            )
        }

        var receipt = NoteSyncReceipt(attemptedCount: pending.count)
        for mutation in pending {
            do {
                let response = try await client.patchDailyNote(mutation)
                if response.ok, let document = response.document {
                    try store.markSynced(mutation: mutation, document: document)
                    receipt.acceptedCount += 1
                } else if response.ok {
                    let error = NoteSyncError.missingAcceptedDocument
                    try store.markFailed(mutation: mutation, error: error)
                    receipt.failedCount += 1
                    receipt.lastErrorDescription = error.localizedDescription
                } else {
                    let error = NoteSyncError.mutationRejected(
                        response.error?.displayMessage ?? response.status ?? "unknown_convex_error"
                    )
                    try store.markFailed(mutation: mutation, error: error)
                    receipt.failedCount += 1
                    receipt.lastErrorDescription = error.localizedDescription
                }
            } catch {
                try? store.markFailed(mutation: mutation, error: error)
                receipt.failedCount += 1
                receipt.lastErrorDescription = error.localizedDescription
            }
        }
        return receipt
    }

    func startRemoteProjection(
        localDate: String,
        onProjected: RemoteDailyNoteProjectionHandler? = nil
    ) {
        projectionTask?.cancel()
        projectionTask = Task { [client, store] in
            let updates = await client
                .dailyNotePublisher(localDate: localDate)
                .replaceError(with: ConvexDailyNoteState(document: nil, status: nil, statuses: nil))
                .values

            for await state in updates {
                if Task.isCancelled { return }
                if let document = state.document {
                    guard let projectedNote = try? store.applyRemoteDocument(document) else {
                        continue
                    }
                    if let onProjected {
                        let statuses = state.statuses ?? state.status.map { [$0] } ?? []
                        let projection = LocalDailyNoteProjection(
                            note: projectedNote,
                            agentStatuses: statuses
                        )
                        await MainActor.run {
                            onProjected(projection)
                        }
                    }
                }
            }
        }
    }
}
