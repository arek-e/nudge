import ComposableArchitecture
import Network
import PencilKit
import SwiftUI
import UIKit

struct NudgeClientFailure: LocalizedError {
    let message: String
    let isAuthenticationRequired: Bool
    let isTimeout: Bool

    init(message: String, isAuthenticationRequired: Bool = false, isTimeout: Bool = false) {
        self.message = message
        self.isAuthenticationRequired = isAuthenticationRequired
        self.isTimeout = isTimeout
    }

    init(error: Error) {
        if let failure = error as? NudgeClientFailure {
            self = failure
            return
        }

        self.message = error.localizedDescription
        self.isAuthenticationRequired = Self.isAuthenticationRequired(error)
        self.isTimeout = (error as? URLError)?.code == .timedOut
            || (error as NSError).code == NSURLErrorTimedOut
    }

    var errorDescription: String? { message }

    private static func isAuthenticationRequired(_ error: Error) -> Bool {
        if case NudgeAPIError.httpStatus(401) = error {
            return true
        }
        return false
    }
}

struct NudgeAPIClient {
    var getAgentRun: @Sendable (_ runId: String) async throws -> AgentRun?
    var getJournal: @Sendable (_ localDate: String) async throws -> JournalDocument?
    var listActions: @Sendable (_ limit: Int) async throws -> ActionsResponse
    var listCalendarDays: @Sendable () async throws -> [CalendarDayStats]
    var listSignals: @Sendable (_ limit: Int) async throws -> [EventRecord]
    var saveDailyNote: @Sendable (
        _ note: String,
        _ attachments: [JournalMediaAttachment],
        _ existingJournalText: String?,
        _ trailingNote: String,
        _ localDate: String,
        _ treatsNoteAsFullBody: Bool
    ) async throws -> SavedCapture
}

extension NudgeAPIClient: DependencyKey {
    static let liveValue = NudgeAPIClient(
        getAgentRun: { runId in
            try await NudgeAPI.getAgentRun(runId: runId)
        },
        getJournal: { localDate in
            try await NudgeAPI.getJournal(localDate: localDate)
        },
        listActions: { limit in
            try await NudgeAPI.listActions(limit: limit)
        },
        listCalendarDays: {
            try await NudgeAPI.listCalendarDays()
        },
        listSignals: { limit in
            try await NudgeAPI.listSignals(limit: limit)
        },
        saveDailyNote: { note, attachments, existingJournalText, trailingNote, localDate, treatsNoteAsFullBody in
            try await NudgeAPI.saveDailyNote(
                note,
                attachments: attachments,
                existingJournalText: existingJournalText,
                trailingNote: trailingNote,
                localDate: localDate,
                treatsNoteAsFullBody: treatsNoteAsFullBody
            )
        }
    )
}

extension DependencyValues {
    var nudgeAPIClient: NudgeAPIClient {
        get { self[NudgeAPIClient.self] }
        set { self[NudgeAPIClient.self] = newValue }
    }
}

struct NudgeNoteSyncClient {
    var localDailyNote: @Sendable (_ localDate: String) async throws -> LocalDailyNote?
    var projections: @Sendable (_ localDate: String) -> AsyncStream<LocalDailyNoteProjection>
    var saveLocalDraft: @Sendable (_ localDate: String, _ title: String, _ bodyText: String) async throws -> LocalDailyNote
    var syncPending: @Sendable () async -> NoteSyncReceipt
}

private actor LiveNudgeNoteSyncBox {
    private var coordinator: NoteSyncCoordinator?

    func localDailyNote(localDate: String) async throws -> LocalDailyNote? {
        let coordinator = try await coordinatorOrThrow()
        return await coordinator.localDailyNote(localDate: localDate)
    }

    nonisolated func projections(localDate: String) -> AsyncStream<LocalDailyNoteProjection> {
        AsyncStream { continuation in
            let task = Task {
                do {
                    let coordinator = try await self.coordinatorOrThrow()
                    await coordinator.startRemoteProjection(localDate: localDate) { projection in
                        continuation.yield(projection)
                    }
                } catch {
                    continuation.finish()
                }
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }

    func saveLocalDraft(localDate: String, title: String, bodyText: String) async throws -> LocalDailyNote {
        let coordinator = try await coordinatorOrThrow()
        return try await coordinator.saveLocalDraft(localDate: localDate, title: title, bodyText: bodyText)
    }

    func syncPending() async -> NoteSyncReceipt {
        do {
            let coordinator = try await coordinatorOrThrow()
            return await coordinator.syncPending()
        } catch {
            return NoteSyncReceipt(
                failedCount: 1,
                lastErrorDescription: NudgeClientFailure(error: error).localizedDescription
            )
        }
    }

    private func coordinatorOrThrow() async throws -> NoteSyncCoordinator {
        if let coordinator {
            return coordinator
        }

        do {
            let store = try LocalNoteStore.live()
            let client = await MainActor.run {
                ConvexNoteClient(client: nudgeConvexClient)
            }
            let coordinator = NoteSyncCoordinator(store: store, client: client)
            self.coordinator = coordinator
            return coordinator
        } catch {
            throw NudgeClientFailure(message: "Local sync unavailable")
        }
    }
}

extension NudgeNoteSyncClient: DependencyKey {
    static let liveValue: NudgeNoteSyncClient = {
        let box = LiveNudgeNoteSyncBox()
        return NudgeNoteSyncClient(
            localDailyNote: { localDate in
                try await box.localDailyNote(localDate: localDate)
            },
            projections: { localDate in
                box.projections(localDate: localDate)
            },
            saveLocalDraft: { localDate, title, bodyText in
                try await box.saveLocalDraft(localDate: localDate, title: title, bodyText: bodyText)
            },
            syncPending: {
                await box.syncPending()
            }
        )
    }()
}

extension DependencyValues {
    var nudgeNoteSyncClient: NudgeNoteSyncClient {
        get { self[NudgeNoteSyncClient.self] }
        set { self[NudgeNoteSyncClient.self] = newValue }
    }
}

struct NudgeNetworkStatusClient {
    var updates: @Sendable () -> AsyncStream<Bool>
}

extension NudgeNetworkStatusClient: DependencyKey {
    static let liveValue = NudgeNetworkStatusClient(
        updates: {
            AsyncStream { continuation in
                let monitor = NWPathMonitor()
                let queue = DispatchQueue(label: "app.nudge.network-monitor")
                monitor.pathUpdateHandler = { path in
                    continuation.yield(path.status == .satisfied)
                }
                monitor.start(queue: queue)
                continuation.onTermination = { _ in monitor.cancel() }
            }
        }
    )
}

extension DependencyValues {
    var nudgeNetworkStatusClient: NudgeNetworkStatusClient {
        get { self[NudgeNetworkStatusClient.self] }
        set { self[NudgeNetworkStatusClient.self] = newValue }
    }
}

struct NudgeStreakClient {
    var load: @Sendable () async -> NudgeStreakSnapshot
    var save: @Sendable (_ dailyStreak: Int, _ lastStreakDate: String) async -> Void
}

struct NudgeStreakSnapshot {
    let dailyStreak: Int
    let lastStreakDate: String
}

extension NudgeStreakClient: DependencyKey {
    static let liveValue = NudgeStreakClient(
        load: {
            let defaults = UserDefaults.standard
            return NudgeStreakSnapshot(
                dailyStreak: defaults.integer(forKey: NudgeCaptureFeature.dailyStreakKey),
                lastStreakDate: defaults.string(forKey: NudgeCaptureFeature.lastStreakDateKey) ?? ""
            )
        },
        save: { dailyStreak, lastStreakDate in
            let defaults = UserDefaults.standard
            defaults.set(dailyStreak, forKey: NudgeCaptureFeature.dailyStreakKey)
            defaults.set(lastStreakDate, forKey: NudgeCaptureFeature.lastStreakDateKey)
        }
    )
}

extension DependencyValues {
    var nudgeStreakClient: NudgeStreakClient {
        get { self[NudgeStreakClient.self] }
        set { self[NudgeStreakClient.self] = newValue }
    }
}

struct NudgePendingCaptureResultContext {
    let noteText: String
    let saved: SavedCapture
}

struct NudgeInitialContext {
    let localNote: LocalDailyNote?
    let streak: NudgeStreakSnapshot
    let syncReceipt: NoteSyncReceipt
}

struct NudgeRefreshContext {
    let actions: ActionsResponse
    let calendarDays: [CalendarDayStats]
    let journal: JournalDocument?
    let retainedRows: [RetainedCaptureRow]
    let signals: [EventRecord]
}

struct NudgeSubmissionRequest {
    let existingJournalText: String?
    let leadingText: String
    let localDate: String
    let mediaAttachments: [JournalMediaAttachment]
    let pendingNoteText: String?
    let previousPendingStage: CaptureStage
    let submission: CaptureSubmissionDraft
    let treatsNoteAsFullBody: Bool
}

struct NudgeLocalDraftResponse {
    let localComposition: JournalSaveComposition
    let localNote: LocalDailyNote
    let request: NudgeSubmissionRequest
}

struct NudgeOptimisticSubmission {
    let localNote: LocalDailyNote
    let optimisticRowId: UUID
    let request: NudgeSubmissionRequest
}

struct NudgeRemoteSubmissionResponse {
    let optimisticRowId: UUID?
    let request: NudgeSubmissionRequest
    let saved: SavedCapture
}

struct NudgeSubmissionFailure: Error {
    let error: NudgeClientFailure
    let savedOnDevice: Bool
}

@Reducer
struct NudgeCaptureFeature {
    static let dailyStreakKey = "nudge.dailyStreak"
    static let lastStreakDateKey = "nudge.lastStreakDate"
    private static let draftAutosaveDelayNanoseconds: UInt64 = 700_000_000

    @ObservableState
    struct State {
        var actions: [ActionItem] = []
        var activeAlert: CaptureAlert?
        var activeSheet: NudgeSheet?
        var addMenuOpen = false
        var attachments: [CaptureAttachment] = []
        var calendarDays: [CalendarDayStats] = []
        var dailyStreak = 0
        var draft = ""
        var drawingOpen = false
        var editingDrawing: CaptureAttachment?
        var errorMessage = ""
        var formattingOpen = false
        var imagePickerSource: CaptureImagePickerSource?
        var isOnline = true
        var journal: JournalDocument?
        var latestResult: CaptureResult?
        var latestRun: AgentRun?
        var navigationPath: [NudgeDestination] = []
        var presentedResult: CaptureResult?
        var previewedAttachment: CaptureAttachment?
        var retainedRows: [RetainedCaptureRow] = []
        var saving = false
        var settingsSignOutError: String?
        var settingsSigningOut = false
        var signals: [EventRecord] = []
        var stage: CaptureStage = .idle
        var statusMessage = "Connecting"
        var trailingDraft = ""
        var voiceRecorderOpen = false

        var draftAutosaveBaseBodyText: String?
        var isDraftHydratedFromDailyNote = false
        var lastAutosavedBodyText: String?
        var lastStreakDate = ""
        var pendingInterruptedDraftText: String?
        var pendingResultContext: NudgePendingCaptureResultContext?

        var chromeSignal: ChromeSignal? {
            ChromeSignalPolicy.evaluate(
                stage: stage,
                statusMessage: statusMessage,
                hasLatestResult: latestResult != nil,
                isOnline: isOnline
            )
        }

        var hasDraft: Bool {
            if let pendingResultContext {
                return draft.trimmingCharacters(in: .whitespacesAndNewlines)
                    != pendingResultContext.noteText.trimmingCharacters(in: .whitespacesAndNewlines)
                    || !trailingDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            }

            return !draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                || !trailingDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                || !attachments.isEmpty
        }

        var hasPendingResult: Bool {
            pendingResultContext != nil
        }

        var openLoopCount: Int {
            actions.filter { action in
                action.status == "proposed" || action.status == "accepted"
            }.count
        }

        var shouldFocusContinuationDraft: Bool {
            pendingResultContext != nil && (stage == .queued || stage == .processing)
        }

        var shouldPollProcessing: Bool {
            (pendingResultContext != nil && (stage == .queued || stage == .processing))
                || retainedRows.contains { $0.stage == .queued || $0.stage == .processing }
        }

        var todayLocalDate: String {
            NudgeCaptureFeature.localDate()
        }

        func calendarStats(selectedDate: String) -> CalendarStatsSnapshot {
            CalendarStatsBuilder.makeDayStats(
                days: calendarDays,
                currentJournalDate: journal?.localDate,
                dailyStreak: dailyStreak,
                selectedDate: selectedDate
            )
        }

        mutating func apply(_ reset: CaptureDraftResetOutcome) {
            if reset.clearsLatestResult {
                latestResult = nil
            }
            if reset.clearsPendingResult {
                pendingResultContext = nil
            }
            stage = reset.stage
        }

        mutating func applyDailyNoteBody(_ bodyText: String?) {
            draftAutosaveBaseBodyText = bodyText
            lastAutosavedBodyText = bodyText
            let hasActiveDraft = !draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                || !trailingDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            if !hasActiveDraft {
                let projectedRows = DailyNoteParagraphRowsPolicy.merge(
                    bodyText: bodyText,
                    retainedRows: retainedRows
                )
                if !projectedRows.isEmpty {
                    retainedRows = projectedRows
                    isDraftHydratedFromDailyNote = false
                    return
                }
            }
            guard pendingResultContext == nil, retainedRows.isEmpty else { return }
            guard let hydratedDraft = DailyNoteDraftHydrationPolicy.evaluate(
                currentDraft: draft,
                currentTrailingDraft: trailingDraft,
                bodyText: bodyText
            ) else {
                if bodyText?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty != false {
                    isDraftHydratedFromDailyNote = false
                }
                return
            }
            draft = hydratedDraft
            isDraftHydratedFromDailyNote = true
        }

        mutating func applyNoteSyncReceipt(_ receipt: NoteSyncReceipt) {
            if receipt.hasFailures {
                statusMessage = "Saved on this device"
                if let lastErrorDescription = receipt.lastErrorDescription {
                    print("Nudge Convex sync failed: \(lastErrorDescription)")
                }
                return
            }

            if receipt.acceptedCount > 0, stage != .processing {
                statusMessage = "Connected"
            }
        }

        mutating func applyProjectedDailyNote(_ projection: LocalDailyNoteProjection) {
            let localNote = projection.note
            journal = Self.journalDocument(from: localNote)
            if draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
               trailingDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                applyDailyNoteBody(localNote.bodyText)
            }
            applyProjectedAgentStatuses(projection.agentStatuses)
            if stage != .processing {
                statusMessage = localNote.syncStatus == "pending_sync" ? "Saved on this device" : "Connected"
            }
        }

        mutating func appendRetainedRow(_ row: RetainedCaptureRow) {
            guard !retainedRows.contains(where: { retainedRow in
                if let mutationId = row.mutationId {
                    return retainedRow.mutationId == mutationId
                }
                if let analysisRunId = row.analysisRunId {
                    return retainedRow.analysisRunId == analysisRunId
                }
                return retainedRow.noteText == row.noteText && retainedRow.stage == row.stage
            }) else {
                return
            }
            retainedRows.append(row)
        }

        func draftCompositionBaseBodyText() -> String? {
            if let draftAutosaveBaseBodyText {
                return draftAutosaveBaseBodyText.isEmpty ? nil : draftAutosaveBaseBodyText
            }
            return journal?.bodyText
        }

        mutating func makeResult(for text: String, saved: SavedCapture) -> CaptureResult {
            let signalTotal = signals.count
            let actionTotal = openLoopCount
            let references = referenceLabels(saved: saved, actionCount: actionTotal, signalCount: signalTotal)
            var items = [
                CaptureDetailItem(
                    title: "Journal",
                    value: saved.journal.localDate,
                    subtitle: "Updated in the Engine.",
                    color: .accentStreak,
                    icon: "doc.text.fill"
                ),
                CaptureDetailItem(
                    title: "Capture",
                    value: saved.capture?.source.displayLabel ?? "Journal",
                    subtitle: saved.capture?.type.displayLabel ?? "Saved for background review",
                    color: .accentCapture,
                    icon: "tray.and.arrow.down.fill"
                )
            ]

            if actionTotal > 0 {
                items.append(
                    CaptureDetailItem(
                        title: "Open actions",
                        value: "\(actionTotal)",
                        subtitle: "Current actions remain available for follow-up.",
                        color: .accentSuccess,
                        icon: "checklist"
                    )
                )
            }
            if let analysisRun = saved.analysisRun {
                items.append(
                    CaptureDetailItem(
                        title: "AI review",
                        value: analysisRun.status.capitalized,
                        subtitle: "Nudge is looking for follow-ups, commitments, and open loops.",
                        color: .accentInsight,
                        icon: "wand.and.stars"
                    )
                )
            }

            return CaptureResult(
                title: text,
                signalCount: signalTotal,
                actionCount: actionTotal,
                sourceCount: references.count,
                summary: "Saved to \(saved.journal.localDate). Nudge can use this capture with the current journal, signals, and action context.",
                items: items,
                references: references
            )
        }

        mutating func updateDailyStreak(for localDate: String) -> Bool {
            guard lastStreakDate != localDate else { return false }
            if NudgeCaptureFeature.previousLocalDate(from: localDate) == lastStreakDate {
                dailyStreak += 1
            } else {
                dailyStreak = 1
            }
            lastStreakDate = localDate
            return true
        }

        mutating func updateRetainedRow(id: UUID, analysisRunId: String?, stage: CaptureStage) {
            guard let index = retainedRows.firstIndex(where: { $0.id == id }) else { return }
            let current = retainedRows[index]
            retainedRows[index] = RetainedCaptureRow(
                id: current.id,
                analysisRunId: analysisRunId,
                mutationId: current.mutationId,
                noteText: current.noteText,
                stage: stage
            )
        }

        static func journalDocument(from localNote: LocalDailyNote) -> JournalDocument {
            JournalDocument(
                id: "local-\(localNote.localDate)",
                localDate: localNote.localDate,
                title: localNote.title,
                bodyText: localNote.bodyText,
                updatedAt: localNote.updatedAt
            )
        }

        private mutating func applyProjectedAgentStatuses(_ statuses: [ConvexRemoteAgentStatus]) {
            let snapshots = statuses.compactMap { status -> ConvexAgentStatusSnapshot? in
                guard let idempotencyKey = status.idempotencyKey else { return nil }
                return ConvexAgentStatusSnapshot(
                    idempotencyKey: idempotencyKey,
                    status: status.status,
                    errorCode: status.errorCode
                )
            }
            retainedRows = ConvexAgentStatusProjectionPolicy.apply(
                statuses: snapshots,
                to: retainedRows
            )
        }

        private func referenceLabels(saved: SavedCapture, actionCount: Int, signalCount: Int) -> [String] {
            var labels = ["Journal \(saved.journal.localDate)"]
            if let capture = saved.capture { labels.append(capture.source.displayLabel) }
            if signalCount > 0 { labels.append("\(signalCount) signal\(signalCount == 1 ? "" : "s")") }
            if actionCount > 0 { labels.append("\(actionCount) open action\(actionCount == 1 ? "" : "s")") }
            if let analysisRun = saved.analysisRun { labels.append("AI review \(analysisRun.status)") }
            return labels
        }
    }

    enum Action: BindableAction {
        case addJournalingSuggestion
        case addLine
        case appendDrawing(PKDrawing)
        case appendImage(UIImage, CaptureImagePickerSource)
        case appendVoiceRecording(URL)
        case applyTextFormat(TextFormatAction)
        case activeSheetChanged(NudgeSheet?)
        case autosaveDraftResponse(Result<LocalDailyNote, NudgeClientFailure>)
        case binding(BindingAction<State>)
        case cameraButtonTapped(isAvailable: Bool)
        case cancelProcessingEditInterruption
        case chromeActionTapped(NudgeChromeAction)
        case confirmProcessingEditInterruption
        case drawingButtonTapped
        case drawingOpenChanged(Bool)
        case draftChanged(String)
        case editingDrawingChanged(CaptureAttachment?)
        case imagePickerSourceChanged(CaptureImagePickerSource?)
        case initialContextLoaded(NudgeInitialContext)
        case localDraftSaved(NudgeLocalDraftResponse)
        case networkStatusChanged(Bool)
        case openAttachment(CaptureAttachment)
        case optimisticLocalSubmissionCompleted(NudgeOptimisticSubmission)
        case pollProcessingStarted
        case photoLibraryButtonTapped
        case presentedResultChanged(CaptureResult?)
        case previewedAttachmentChanged(CaptureAttachment?)
        case projectionReceived(LocalDailyNoteProjection)
        case refreshContext
        case refreshContextResponse(Result<NudgeRefreshContext, NudgeClientFailure>)
        case remoteSubmissionResponse(Result<NudgeRemoteSubmissionResponse, NudgeSubmissionFailure>)
        case removeAttachment(CaptureAttachment)
        case settingsSignOutDismissed
        case settingsSignOutTapped
        case settingsSignOutResponse(Result<Void, NudgeClientFailure>)
        case submit
        case submitResponse(Result<NudgeRemoteSubmissionResponse, NudgeSubmissionFailure>)
        case syncPendingResponse(NoteSyncReceipt)
        case task
        case trailingDraftChanged(String)
        case updateDrawing(CaptureAttachment, PKDrawing)
        case voiceRecorderOpenChanged(Bool)
        case voiceRecorderButtonTapped
    }

    @Dependency(\.nudgeAPIClient) private var api
    @Dependency(\.nudgeAuthClient) private var auth
    @Dependency(\.nudgeNetworkStatusClient) private var network
    @Dependency(\.nudgeNoteSyncClient) private var noteSync
    @Dependency(\.nudgeStreakClient) private var streak

    private enum CancelID {
        case autosave
        case network
        case poll
        case projection
    }

    var body: some ReducerOf<Self> {
        BindingReducer()

        Reduce { state, action in
            switch action {
            case .addJournalingSuggestion:
                if state.attachments.isEmpty && state.pendingResultContext == nil {
                    state.draft = Self.appending("Today, I noticed ", to: state.draft)
                } else {
                    state.trailingDraft = Self.appending("Today, I noticed ", to: state.trailingDraft)
                }
                if state.pendingResultContext == nil {
                    state.latestResult = nil
                    state.stage = .idle
                }
                return scheduleDraftAutosave(state: &state)

            case .addLine:
                if state.attachments.isEmpty && state.pendingResultContext == nil {
                    state.draft = Self.appending("Remember ", to: state.draft)
                } else {
                    state.trailingDraft = Self.appending("Remember ", to: state.trailingDraft)
                }
                return scheduleDraftAutosave(state: &state)

            case .activeSheetChanged(let sheet):
                state.activeSheet = sheet
                return .none

            case .appendDrawing(let drawing):
                guard let attachment = CaptureAttachment.drawing(drawing) else {
                    state.errorMessage = "Could not attach that drawing."
                    return .none
                }
                state.attachments.append(attachment)
                state.latestResult = nil
                state.pendingResultContext = nil
                state.errorMessage = ""
                state.stage = .idle
                return .none

            case .appendImage(let image, let source):
                let kind: CaptureAttachmentKind = source == .camera ? .cameraPhoto : .libraryPhoto
                guard let attachment = CaptureAttachment.image(image, kind: kind) else {
                    state.errorMessage = "Could not attach that image."
                    return .none
                }
                state.attachments.append(attachment)
                state.latestResult = nil
                state.errorMessage = ""
                state.stage = .idle
                return .none

            case .appendVoiceRecording(let url):
                guard let attachment = CaptureAttachment.voiceRecording(url: url) else {
                    state.errorMessage = "Could not attach that recording."
                    return .none
                }
                state.attachments.append(attachment)
                state.latestResult = nil
                state.pendingResultContext = nil
                state.errorMessage = ""
                state.stage = .idle
                return .none

            case .applyTextFormat(let format):
                let formatsContinuation = state.pendingResultContext != nil || !state.attachments.isEmpty
                if state.pendingResultContext == nil {
                    state.latestResult = nil
                    state.stage = .idle
                }

                let text = formatsContinuation ? state.trailingDraft : state.draft
                let formatted = Self.formatted(text, as: format)
                if formatsContinuation {
                    state.trailingDraft = formatted
                } else {
                    state.draft = formatted
                }
                return scheduleDraftAutosave(state: &state)

            case .autosaveDraftResponse(.success(let localNote)):
                state.lastAutosavedBodyText = localNote.bodyText
                state.journal = State.journalDocument(from: localNote)
                let streakChanged = state.updateDailyStreak(for: localNote.localDate)
                if state.stage == .idle {
                    state.statusMessage = "Saved on this device"
                }
                return .merge(
                    persistStreakIfNeeded(streakChanged, state: state),
                    .run { send in
                        let receipt = await noteSync.syncPending()
                        await send(.syncPendingResponse(receipt))
                    }
                )

            case .autosaveDraftResponse(.failure):
                state.statusMessage = "Saved on this device"
                return .none

            case .binding:
                return .none

            case .cameraButtonTapped(let isAvailable):
                if isAvailable {
                    state.imagePickerSource = .camera
                } else {
                    state.errorMessage = "Camera is not available on this device."
                }
                return .none

            case .cancelProcessingEditInterruption:
                state.pendingInterruptedDraftText = nil
                state.activeAlert = nil
                return .none

            case .chromeActionTapped(.statusSignal):
                if let latestResult = state.latestResult {
                    state.presentedResult = latestResult
                    return .none
                }
                return .send(.refreshContext)

            case .chromeActionTapped(let action):
                if let destination = action.destination {
                    state.navigationPath.append(destination)
                }
                if let sheet = action.sheet {
                    state.activeSheet = sheet
                }
                return .none

            case .confirmProcessingEditInterruption:
                guard let pendingInterruptedDraftText = state.pendingInterruptedDraftText else {
                    state.activeAlert = nil
                    return .none
                }

                let reset = CaptureDraftResetOutcome(
                    clearsLatestResult: state.latestResult != nil,
                    clearsPendingResult: state.pendingResultContext != nil,
                    stage: .idle
                )
                state.draft = pendingInterruptedDraftText
                state.pendingInterruptedDraftText = nil
                state.activeAlert = nil
                state.apply(reset)
                state.statusMessage = "Editing note"
                return scheduleDraftAutosave(state: &state)

            case .drawingButtonTapped:
                state.drawingOpen = true
                return .none

            case .drawingOpenChanged(let isOpen):
                state.drawingOpen = isOpen
                return .none

            case .draftChanged(let text):
                let processingEdit = CaptureProcessingEditPolicy.evaluate(
                    isLeadingDraft: true,
                    currentText: state.draft,
                    nextText: text,
                    hasPendingResult: state.pendingResultContext != nil,
                    stage: state.stage
                )
                if processingEdit.requiresInterruptionConfirmation {
                    state.pendingInterruptedDraftText = text
                    state.activeAlert = .processingEditInterruption
                    return .none
                }

                let reset = CaptureDraftResetPolicy.evaluate(
                    currentText: state.draft,
                    nextText: text,
                    hasLatestResult: state.latestResult != nil,
                    hasPendingResult: state.pendingResultContext != nil,
                    stage: state.stage
                )
                state.draft = text
                if text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    state.isDraftHydratedFromDailyNote = false
                }
                state.apply(reset)
                return scheduleDraftAutosave(state: &state)

            case .editingDrawingChanged(let attachment):
                state.editingDrawing = attachment
                return .none

            case .imagePickerSourceChanged(let source):
                state.imagePickerSource = source
                return .none

            case .initialContextLoaded(let context):
                state.dailyStreak = context.streak.dailyStreak
                state.lastStreakDate = context.streak.lastStreakDate
                if let localNote = context.localNote {
                    state.journal = State.journalDocument(from: localNote)
                    state.applyDailyNoteBody(localNote.bodyText)
                    if localNote.syncStatus == "pending_sync" {
                        state.statusMessage = "Saved on this device"
                    }
                }
                state.applyNoteSyncReceipt(context.syncReceipt)
                return .none

            case .localDraftSaved(let response):
                state.journal = State.journalDocument(from: response.localNote)
                state.draftAutosaveBaseBodyText = response.localNote.bodyText
                state.lastAutosavedBodyText = response.localNote.bodyText
                let streakChanged = state.updateDailyStreak(for: response.localNote.localDate)
                return persistStreakIfNeeded(streakChanged, state: state)

            case .networkStatusChanged(let nextIsOnline):
                let wasOnline = state.isOnline
                state.isOnline = nextIsOnline
                guard nextIsOnline, !wasOnline else {
                    return .none
                }
                return .run { send in
                    let receipt = await noteSync.syncPending()
                    await send(.syncPendingResponse(receipt))
                }

            case .openAttachment(let attachment):
                if attachment.kind == .drawing, attachment.drawing != nil {
                    state.editingDrawing = attachment
                } else {
                    state.previewedAttachment = attachment
                }
                return .none

            case .optimisticLocalSubmissionCompleted(let submission):
                let transition = CaptureSubmissionTransitionPolicy.evaluate(
                    analysisRunId: state.pendingResultContext?.saved.analysisRun?.id,
                    currentLeadingText: state.draft.trimmingCharacters(in: .whitespacesAndNewlines),
                    submittedNoteText: submission.request.submission.noteText,
                    pendingNoteText: submission.request.pendingNoteText,
                    stage: submission.request.previousPendingStage
                )
                if let retainedRow = transition.retainedRow {
                    state.appendRetainedRow(retainedRow)
                }

                state.appendRetainedRow(
                    RetainedCaptureRow(
                        id: submission.optimisticRowId,
                        analysisRunId: nil,
                        mutationId: submission.localNote.pendingMutationId,
                        noteText: submission.request.submission.noteText,
                        stage: CaptureOptimisticLocalRowPolicy.evaluate()
                    )
                )
                state.attachments.removeAll()
                state.draft = ""
                state.isDraftHydratedFromDailyNote = false
                state.trailingDraft = ""
                state.latestResult = nil
                state.pendingResultContext = nil
                state.errorMessage = ""
                state.stage = .saved
                state.statusMessage = "Saved on this device"
                state.saving = false
                return .none

            case .pollProcessingStarted:
                guard state.shouldPollProcessing else {
                    return .cancel(id: CancelID.poll)
                }
                return .run { send in
                    while !Task.isCancelled {
                        try await Task.sleep(nanoseconds: 2_000_000_000)
                        if Task.isCancelled { return }
                        await send(.refreshContext)
                    }
                }
                .cancellable(id: CancelID.poll, cancelInFlight: true)

            case .photoLibraryButtonTapped:
                state.imagePickerSource = .photoLibrary
                return .none

            case .presentedResultChanged(let result):
                state.presentedResult = result
                return .none

            case .previewedAttachmentChanged(let attachment):
                state.previewedAttachment = attachment
                return .none

            case .projectionReceived(let projection):
                state.applyProjectedDailyNote(projection)
                return .none

            case .refreshContext:
                let localDate = Self.localDate()
                let retainedRows = state.retainedRows
                return .run { send in
                    do {
                        async let loadedSignals = api.listSignals(24)
                        async let loadedCalendarDays = api.listCalendarDays()
                        async let loadedActions = api.listActions(24)
                        async let loadedJournal = api.getJournal(localDate)

                        let actionsResponse = try await loadedActions
                        let signals = try await loadedSignals
                        let calendarDays = try await loadedCalendarDays
                        let journal = try await loadedJournal
                        let rows = await refreshRetainedRows(retainedRows)
                        await send(.refreshContextResponse(.success(
                            NudgeRefreshContext(
                                actions: actionsResponse,
                                calendarDays: calendarDays,
                                journal: journal,
                                retainedRows: rows,
                                signals: signals
                            )
                        )))
                    } catch {
                        if let localNote = try? await noteSync.localDailyNote(localDate) {
                            await send(.projectionReceived(
                                LocalDailyNoteProjection(note: localNote, agentStatuses: [])
                            ))
                        } else {
                            await send(.refreshContextResponse(.failure(NudgeClientFailure(error: error))))
                        }
                    }
                }

            case .refreshContextResponse(.success(let context)):
                state.signals = context.signals
                state.calendarDays = context.calendarDays
                state.actions = context.actions.actions
                state.journal = context.journal
                if state.draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
                   state.trailingDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    state.applyDailyNoteBody(context.journal?.bodyText)
                }
                state.latestRun = context.actions.latestRun
                let isProcessing = context.actions.latestRun?.isProcessing == true
                let tracksPendingResult = state.pendingResultContext != nil
                if isProcessing && tracksPendingResult {
                    state.stage = .processing
                    state.statusMessage = "Processing in background"
                } else if let latestRun = context.actions.latestRun, latestRun.isFailed, tracksPendingResult {
                    let completion = CaptureSaveCompletionPolicy.evaluate(
                        isProcessing: false,
                        errorCode: latestRun.errorCode
                    )
                    state.stage = completion.stage
                    state.statusMessage = completion.statusMessage
                } else if let pendingResultContext = state.pendingResultContext {
                    let completedSave = SavedCapture(
                        analysisRun: context.actions.latestRun ?? pendingResultContext.saved.analysisRun,
                        journal: context.journal ?? pendingResultContext.saved.journal,
                        capture: pendingResultContext.saved.capture
                    )
                    state.latestResult = state.makeResult(for: pendingResultContext.noteText, saved: completedSave)
                    state.pendingResultContext = nil
                    state.stage = .saved
                    state.statusMessage = "Saved to Nudge"
                } else if state.stage == .queued || state.stage == .processing {
                    state.stage = .idle
                    state.statusMessage = "Connected"
                } else {
                    state.statusMessage = "Connected"
                }
                state.retainedRows = context.retainedRows
                return .none

            case .refreshContextResponse(.failure(let error)):
                if error.isAuthenticationRequired {
                    state.statusMessage = "Server sign-in required"
                } else {
                    state.statusMessage = "Engine unavailable"
                }
                return .none

            case .remoteSubmissionResponse(.success(let response)):
                state.latestRun = response.saved.analysisRun ?? state.latestRun
                state.journal = response.saved.journal
                state.draftAutosaveBaseBodyText = response.saved.journal.bodyText
                state.lastAutosavedBodyText = response.saved.journal.bodyText
                let streakChanged = state.updateDailyStreak(for: response.saved.journal.localDate)
                state.latestResult = state.makeResult(for: response.request.submission.noteText, saved: response.saved)
                if let optimisticRowId = response.optimisticRowId {
                    state.updateRetainedRow(
                        id: optimisticRowId,
                        analysisRunId: response.saved.analysisRun?.id,
                        stage: response.saved.analysisRun.map(Self.stage(for:)) ?? .saved
                    )
                }
                state.statusMessage = "Saved to Nudge"
                return persistStreakIfNeeded(streakChanged, state: state)

            case .remoteSubmissionResponse(.failure(let failure)):
                if failure.error.isAuthenticationRequired {
                    state.statusMessage = "Server sign-in required"
                } else {
                    state.statusMessage = "Saved on this device"
                }
                return .none

            case .removeAttachment(let attachment):
                state.attachments.removeAll { $0.id == attachment.id }
                if state.editingDrawing?.id == attachment.id { state.editingDrawing = nil }
                if state.previewedAttachment?.id == attachment.id { state.previewedAttachment = nil }
                if state.attachments.isEmpty, !state.trailingDraft.isEmpty {
                    state.draft = [state.draft, state.trailingDraft]
                        .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                        .filter { !$0.isEmpty }
                        .joined(separator: "\n")
                    state.trailingDraft = ""
                }
                state.latestResult = nil
                state.pendingResultContext = nil
                return .none

            case .settingsSignOutDismissed:
                state.settingsSignOutError = nil
                return .none

            case .settingsSignOutTapped:
                guard !state.settingsSigningOut else { return .none }
                state.settingsSigningOut = true
                state.settingsSignOutError = nil
                return .run { send in
                    do {
                        try await auth.signOut()
                        await send(.settingsSignOutResponse(.success(())))
                    } catch {
                        await send(.settingsSignOutResponse(.failure(NudgeClientFailure(error: error))))
                    }
                }

            case .settingsSignOutResponse(.success):
                state.settingsSigningOut = false
                return .none

            case .settingsSignOutResponse(.failure(let error)):
                state.settingsSigningOut = false
                state.settingsSignOutError = error.localizedDescription
                return .none

            case .submit:
                return submitEffect(state: &state)

            case .submitResponse(.success(let response)):
                let request = response.request
                state.latestRun = response.saved.analysisRun ?? state.latestRun
                state.journal = response.saved.journal
                let streakChanged = state.updateDailyStreak(for: response.saved.journal.localDate)

                if request.pendingNoteText != nil {
                    let transition = CaptureSubmissionTransitionPolicy.evaluate(
                        analysisRunId: state.pendingResultContext?.saved.analysisRun?.id,
                        currentLeadingText: request.leadingText,
                        submittedNoteText: request.submission.noteText,
                        pendingNoteText: request.pendingNoteText,
                        stage: request.previousPendingStage
                    )
                    if let retainedRow = transition.retainedRow {
                        state.appendRetainedRow(retainedRow)
                    }
                    state.draft = transition.leadingText
                    state.trailingDraft = transition.trailingText
                }

                let result = state.makeResult(for: request.submission.noteText, saved: response.saved)
                let completion = CaptureSaveCompletionPolicy.evaluate(
                    isProcessing: state.latestRun?.isProcessing == true,
                    errorCode: state.latestRun?.isFailed == true ? state.latestRun?.errorCode : nil
                )
                if completion.showsResultRow {
                    state.latestResult = result
                    state.pendingResultContext = nil
                } else if completion.keepsResultPending {
                    state.latestResult = nil
                    state.pendingResultContext = NudgePendingCaptureResultContext(noteText: request.submission.noteText, saved: response.saved)
                }
                if completion.autoPresentsDrawer {
                    state.presentedResult = result
                }
                state.stage = completion.stage
                state.statusMessage = completion.statusMessage
                state.saving = false
                return .merge(
                    persistStreakIfNeeded(streakChanged, state: state),
                    .send(.refreshContext)
                )

            case .submitResponse(.failure(let failure)):
                let result = CaptureSubmissionFailurePolicy.evaluate(
                    savedOnDevice: failure.savedOnDevice,
                    isTimeout: failure.error.isTimeout,
                    isAuthenticationRequired: failure.error.isAuthenticationRequired,
                    localizedError: failure.error.localizedDescription
                )
                state.stage = result.stage
                state.errorMessage = result.errorMessage
                state.statusMessage = result.statusMessage
                state.saving = false
                return .none

            case .syncPendingResponse(let receipt):
                state.applyNoteSyncReceipt(receipt)
                return .none

            case .task:
                let localDate = Self.localDate()
                return .merge(
                    .run { send in
                        let streakSnapshot = await streak.load()
                        let localNote = try? await noteSync.localDailyNote(localDate)
                        let receipt = await noteSync.syncPending()
                        await send(.initialContextLoaded(
                            NudgeInitialContext(
                                localNote: localNote,
                                streak: streakSnapshot,
                                syncReceipt: receipt
                            )
                        ))
                    },
                    .run { send in
                        for await projection in noteSync.projections(localDate) {
                            await send(.projectionReceived(projection))
                        }
                    }
                    .cancellable(id: CancelID.projection, cancelInFlight: true),
                    .run { send in
                        for await isOnline in network.updates() {
                            await send(.networkStatusChanged(isOnline))
                        }
                    }
                    .cancellable(id: CancelID.network, cancelInFlight: true),
                    .send(.refreshContext)
                )

            case .trailingDraftChanged(let text):
                let reset = CaptureDraftResetPolicy.evaluate(
                    currentText: state.trailingDraft,
                    nextText: text,
                    hasLatestResult: state.latestResult != nil,
                    hasPendingResult: state.pendingResultContext != nil,
                    stage: state.stage
                )
                state.trailingDraft = text
                state.apply(reset)
                return scheduleDraftAutosave(state: &state)

            case .updateDrawing(let attachment, let drawing):
                guard let updated = CaptureAttachment.drawing(drawing, id: attachment.id),
                      let index = state.attachments.firstIndex(where: { $0.id == attachment.id }) else {
                    state.errorMessage = "Could not update that drawing."
                    return .none
                }
                state.attachments[index] = updated
                state.latestResult = nil
                state.pendingResultContext = nil
                state.errorMessage = ""
                state.stage = .idle
                return .none

            case .voiceRecorderButtonTapped:
                state.voiceRecorderOpen = true
                return .none

            case .voiceRecorderOpenChanged(let isOpen):
                state.voiceRecorderOpen = isOpen
                return .none
            }
        }
    }

    private func refreshRetainedRows(_ retainedRows: [RetainedCaptureRow]) async -> [RetainedCaptureRow] {
        var updatedRows: [RetainedCaptureRow] = []
        for row in retainedRows {
            guard (row.stage == .queued || row.stage == .processing), let analysisRunId = row.analysisRunId else {
                updatedRows.append(row)
                continue
            }
            guard let run = try? await api.getAgentRun(analysisRunId) else {
                updatedRows.append(row)
                continue
            }
            updatedRows.append(
                RetainedCaptureRow(
                    id: row.id,
                    analysisRunId: row.analysisRunId,
                    mutationId: row.mutationId,
                    noteText: row.noteText,
                    stage: Self.stage(for: run)
                )
            )
        }
        return updatedRows
    }

    private func scheduleDraftAutosave(state: inout State) -> Effect<Action> {
        let baseBodyText = state.draftCompositionBaseBodyText()
        if state.draftAutosaveBaseBodyText == nil {
            state.draftAutosaveBaseBodyText = baseBodyText ?? ""
        }
        guard let autosave = CaptureDraftAutosavePolicy.evaluate(
            existingJournalText: baseBodyText,
            leadingDraft: state.draft,
            trailingDraft: state.trailingDraft,
            treatsLeadingDraftAsFullBody: state.isDraftHydratedFromDailyNote
        ) else {
            return .cancel(id: CancelID.autosave)
        }
        guard autosave.bodyText != state.lastAutosavedBodyText else { return .none }

        let bodyText = autosave.bodyText
        let localDate = Self.localDate()
        let title = localDate
        return .run { send in
            do {
                try await Task.sleep(nanoseconds: Self.draftAutosaveDelayNanoseconds)
                if Task.isCancelled { return }
                let localNote = try await noteSync.saveLocalDraft(localDate, title, bodyText)
                await send(.autosaveDraftResponse(.success(localNote)))
            } catch {
                await send(.autosaveDraftResponse(.failure(NudgeClientFailure(error: error))))
            }
        }
        .cancellable(id: CancelID.autosave, cancelInFlight: true)
    }

    private func submitEffect(state: inout State) -> Effect<Action> {
        let leadingText = state.draft.trimmingCharacters(in: .whitespacesAndNewlines)
        let trailingText = state.trailingDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        let pendingNoteText = state.pendingResultContext?.noteText
        let previousPendingStage = state.stage
        let existingJournalText = state.draftCompositionBaseBodyText()
        let localDate = Self.localDate()
        let submission = CaptureSubmissionDraftPolicy.evaluate(
            leadingText: leadingText,
            trailingText: trailingText,
            attachmentLabels: state.attachments.map(\.label),
            pendingNoteText: pendingNoteText,
            existingJournalText: existingJournalText,
            treatsLeadingTextAsFullBody: state.isDraftHydratedFromDailyNote
        )
        guard submission.hasContent else {
            if pendingNoteText == nil {
                state.errorMessage = "Say or type something first."
            }
            return .none
        }
        guard !state.saving else { return .none }

        let mediaAttachments = submission.includesAttachments ? state.attachments.map(\.journalAttachment) : []
        let localComposition = JournalSaveCompositionPolicy.evaluate(
            existingJournalText: existingJournalText,
            leadingNote: submission.leadingNote,
            trailingNote: submission.trailingNote,
            treatsLeadingNoteAsFullBody: state.isDraftHydratedFromDailyNote
        )
        let request = NudgeSubmissionRequest(
            existingJournalText: existingJournalText,
            leadingText: leadingText,
            localDate: localDate,
            mediaAttachments: mediaAttachments,
            pendingNoteText: pendingNoteText,
            previousPendingStage: previousPendingStage,
            submission: submission,
            treatsNoteAsFullBody: state.isDraftHydratedFromDailyNote
        )

        state.saving = true
        state.errorMessage = ""
        state.latestResult = nil
        state.statusMessage = "Saving"
        state.stage = .saving

        return .merge(
            .cancel(id: CancelID.autosave),
            .run { send in
                var savedOnDevice = false
                var localNoteForOptimisticSubmission: LocalDailyNote?
                do {
                    let localNote = try await noteSync.saveLocalDraft(
                        localDate,
                        localDate,
                        localComposition.journalBodyText
                    )
                    savedOnDevice = true
                    localNoteForOptimisticSubmission = localNote
                    await send(.localDraftSaved(
                        NudgeLocalDraftResponse(
                            localComposition: localComposition,
                            localNote: localNote,
                            request: request
                        )
                    ))
                } catch {
                    savedOnDevice = false
                }

                if let localNote = localNoteForOptimisticSubmission, mediaAttachments.isEmpty {
                    let optimisticRowId = UUID()
                    await send(.optimisticLocalSubmissionCompleted(
                        NudgeOptimisticSubmission(
                            localNote: localNote,
                            optimisticRowId: optimisticRowId,
                            request: request
                        )
                    ))
                    let receipt = await noteSync.syncPending()
                    await send(.syncPendingResponse(receipt))
                    do {
                        let saved = try await api.saveDailyNote(
                            request.submission.leadingNote,
                            request.mediaAttachments,
                            request.existingJournalText,
                            request.submission.trailingNote,
                            request.localDate,
                            request.treatsNoteAsFullBody
                        )
                        await send(.remoteSubmissionResponse(.success(
                            NudgeRemoteSubmissionResponse(
                                optimisticRowId: optimisticRowId,
                                request: request,
                                saved: saved
                            )
                        )))
                    } catch {
                        await send(.remoteSubmissionResponse(.failure(
                            NudgeSubmissionFailure(
                                error: NudgeClientFailure(error: error),
                                savedOnDevice: true
                            )
                        )))
                    }
                    return
                }

                do {
                    let saved = try await api.saveDailyNote(
                        request.submission.leadingNote,
                        request.mediaAttachments,
                        request.existingJournalText,
                        request.submission.trailingNote,
                        request.localDate,
                        request.treatsNoteAsFullBody
                    )
                    await send(.submitResponse(.success(
                        NudgeRemoteSubmissionResponse(
                            optimisticRowId: nil,
                            request: request,
                            saved: saved
                        )
                    )))
                } catch {
                    await send(.submitResponse(.failure(
                        NudgeSubmissionFailure(
                            error: NudgeClientFailure(error: error),
                            savedOnDevice: savedOnDevice && mediaAttachments.isEmpty
                        )
                    )))
                }
            }
        )
    }

    private func persistStreakIfNeeded(_ changed: Bool, state: State) -> Effect<Action> {
        guard changed else { return .none }
        let dailyStreak = state.dailyStreak
        let lastStreakDate = state.lastStreakDate
        return .run { _ in
            await streak.save(dailyStreak, lastStreakDate)
        }
    }

    static func appending(_ line: String, to text: String) -> String {
        text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            ? line
            : text + "\n" + line
    }

    static func formatted(_ draft: String, as format: TextFormatAction) -> String {
        switch format {
        case .heading:
            let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
            return text.isEmpty ? "# " : "# \(text)"
        case .bullet:
            if draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                return "- "
            }
            return draft + "\n- "
        case .bold:
            let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
            return text.isEmpty ? "**bold text**" : "**\(text)**"
        case .italic:
            let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
            return text.isEmpty ? "_italic text_" : "_\(text)_"
        }
    }

    static func localDate(_ date: Date = Date()) -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }

    static func previousLocalDate(from localDate: String) -> String? {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.dateFormat = "yyyy-MM-dd"
        guard let date = formatter.date(from: localDate),
              let previous = formatter.calendar.date(byAdding: .day, value: -1, to: date) else {
            return nil
        }
        return formatter.string(from: previous)
    }

    static func stage(for run: AgentRun) -> CaptureStage {
        if run.isFailed {
            return run.errorCode == "AI_EXTRACTION_TIMEOUT" ? .analysisTimedOut : .analysisFailed
        }
        switch run.status.lowercased() {
        case "pending", "queued":
            return .queued
        case "in_progress", "processing", "running":
            return .processing
        default:
            break
        }
        return .saved
    }
}
