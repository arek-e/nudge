import PencilKit
import Network
import SwiftUI
import UIKit

enum CaptureAttachmentKind {
    case cameraPhoto
    case drawing
    case libraryPhoto
    case voice

    var documentKind: String {
        switch self {
        case .cameraPhoto, .drawing, .libraryPhoto:
            "image"
        case .voice:
            "voice"
        }
    }

    var icon: String {
        switch self {
        case .cameraPhoto:
            "camera.fill"
        case .drawing:
            "scribble"
        case .libraryPhoto:
            "photo.fill"
        case .voice:
            "waveform"
        }
    }

    var label: String {
        switch self {
        case .cameraPhoto:
            "Camera photo"
        case .drawing:
            "Drawing"
        case .libraryPhoto:
            "Photo"
        case .voice:
            "Voice recording"
        }
    }
}

struct CaptureAttachment: Identifiable {
    let id: String
    let kind: CaptureAttachmentKind
    let drawing: PKDrawing?
    let mimeType: String
    let dataURL: String
    let thumbnail: UIImage?

    var label: String { kind.label }

    var journalAttachment: JournalMediaAttachment {
        JournalMediaAttachment(
            id: id,
            kind: kind.documentKind,
            label: label,
            mimeType: mimeType,
            dataURL: dataURL
        )
    }

    static func image(_ image: UIImage, kind: CaptureAttachmentKind) -> CaptureAttachment? {
        let prepared = image.vestaPreparedForUpload(maxDimension: 1600)
        guard let data = prepared.jpegData(compressionQuality: 0.82) else { return nil }
        return CaptureAttachment(
            id: UUID().uuidString,
            kind: kind,
            drawing: nil,
            mimeType: "image/jpeg",
            dataURL: "data:image/jpeg;base64,\(data.base64EncodedString())",
            thumbnail: prepared.vestaPreparedForUpload(maxDimension: 360)
        )
    }

    static func drawing(_ drawing: PKDrawing, id: String = UUID().uuidString) -> CaptureAttachment? {
        let bounds = drawing.bounds.insetBy(dx: -36, dy: -36)
        guard !bounds.isEmpty else { return nil }
        let image = drawing.image(from: bounds, scale: UIScreen.main.scale)
        let prepared = image.vestaScaled(maxDimension: 1600)
        guard let data = prepared.pngData() else { return nil }

        return CaptureAttachment(
            id: id,
            kind: .drawing,
            drawing: drawing,
            mimeType: "image/png",
            dataURL: "data:image/png;base64,\(data.base64EncodedString())",
            thumbnail: prepared.vestaScaled(maxDimension: 360)
        )
    }

    static func voiceRecording(url: URL) -> CaptureAttachment? {
        guard let data = try? Data(contentsOf: url), !data.isEmpty else { return nil }
        return CaptureAttachment(
            id: UUID().uuidString,
            kind: .voice,
            drawing: nil,
            mimeType: "audio/mp4",
            dataURL: "data:audio/mp4;base64,\(data.base64EncodedString())",
            thumbnail: nil
        )
    }

    var previewImage: UIImage? {
        if let thumbnail { return thumbnail }
        guard let encoded = dataURL.split(separator: ",", maxSplits: 1).last,
              let data = Data(base64Encoded: String(encoded)) else {
            return nil
        }
        return UIImage(data: data)
    }
}

enum TextFormatAction {
    case bold
    case bullet
    case heading
    case italic
}

private struct PendingCaptureResultContext {
    let noteText: String
    let saved: SavedCapture
}

@MainActor
final class VestaCaptureViewModel: ObservableObject {
    private static let dailyStreakKey = "vesta.dailyStreak"
    private static let draftAutosaveDelayNanoseconds: UInt64 = 700_000_000
    private static let lastStreakDateKey = "vesta.lastStreakDate"
    private let defaults = UserDefaults.standard

    @Published var actions: [ActionItem] = []
    @Published var activeAlert: CaptureAlert?
    @Published var attachments: [CaptureAttachment] = []
    @Published var calendarDays: [CalendarDayStats] = []
    @Published private(set) var dailyStreak: Int
    @Published var draft = ""
    @Published var errorMessage = ""
    @Published var journal: JournalDocument?
    @Published var latestRun: AgentRun?
    @Published var latestResult: CaptureResult?
    @Published private(set) var isOnline = true
    @Published var presentedResult: CaptureResult?
    @Published var previewedAttachment: CaptureAttachment?
    @Published var editingDrawing: CaptureAttachment?
    @Published var retainedRows: [RetainedCaptureRow] = []
    @Published var saving = false
    @Published var signals: [EventRecord] = []
    @Published var stage: CaptureStage = .idle
    @Published var statusMessage = "Connecting"
    @Published var trailingDraft = ""
    private let noteSyncCoordinator: NoteSyncCoordinator?
    private var draftAutosaveBaseBodyText: String?
    private var draftAutosaveTask: Task<Void, Never>?
    private var isDraftHydratedFromDailyNote = false
    private var lastAutosavedBodyText: String?
    private var lastStreakDate: String
    private let networkMonitor = NWPathMonitor()
    private let networkMonitorQueue = DispatchQueue(label: "app.vesta.network-monitor")
    private var pendingInterruptedDraftText: String?
    private var pendingResultContext: PendingCaptureResultContext?

    init() {
        dailyStreak = defaults.integer(forKey: Self.dailyStreakKey)
        lastStreakDate = defaults.string(forKey: Self.lastStreakDateKey) ?? ""
        do {
            let store = try LocalNoteStore.live()
            noteSyncCoordinator = NoteSyncCoordinator(
                store: store,
                client: ConvexNoteClient(client: vestaConvexClient)
            )
            Task { [weak self, noteSyncCoordinator] in
                guard let self else { return }
                let localDate = Self.localDate()
                if let localNote = await noteSyncCoordinator?.localDailyNote(localDate: localDate) {
                    journal = Self.journalDocument(from: localNote)
                    applyDailyNoteBody(localNote.bodyText)
                    if localNote.syncStatus == "pending_sync" {
                        statusMessage = "Saved on this device"
                    }
                }
                await noteSyncCoordinator?.startRemoteProjection(localDate: localDate) { [weak self] projection in
                    self?.applyProjectedDailyNote(projection)
                }
                if let receipt = await noteSyncCoordinator?.syncPending() {
                    apply(noteSyncReceipt: receipt)
                }
            }
        } catch {
            print("Vesta local note store failed: \(error.localizedDescription)")
            statusMessage = "Local sync unavailable"
            noteSyncCoordinator = nil
        }
        startNetworkMonitor()
    }

    deinit {
        draftAutosaveTask?.cancel()
        networkMonitor.cancel()
    }

    private func startNetworkMonitor() {
        networkMonitor.pathUpdateHandler = { [weak self] path in
            let nextIsOnline = path.status == .satisfied
            Task { @MainActor [weak self] in
                guard let self else { return }
                let wasOnline = self.isOnline
                self.isOnline = nextIsOnline
                guard nextIsOnline, !wasOnline, let noteSyncCoordinator = self.noteSyncCoordinator else {
                    return
                }
                let receipt = await noteSyncCoordinator.syncPending()
                self.apply(noteSyncReceipt: receipt)
            }
        }
        networkMonitor.start(queue: networkMonitorQueue)
    }

    var openLoopCount: Int {
        actions.filter { action in
            action.status == "proposed" || action.status == "accepted"
        }.count
    }

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

    var shouldFocusContinuationDraft: Bool {
        pendingResultContext != nil && (stage == .queued || stage == .processing)
    }

    var shouldPollProcessing: Bool {
        (pendingResultContext != nil && (stage == .queued || stage == .processing))
            || retainedRows.contains { $0.stage == .queued || $0.stage == .processing }
    }

    var todayLocalDate: String {
        Self.localDate()
    }

    func updateDraft(_ text: String) {
        let processingEdit = CaptureProcessingEditPolicy.evaluate(
            isLeadingDraft: true,
            currentText: draft,
            nextText: text,
            hasPendingResult: pendingResultContext != nil,
            stage: stage
        )
        if processingEdit.requiresInterruptionConfirmation {
            pendingInterruptedDraftText = text
            activeAlert = .processingEditInterruption
            return
        }

        let reset = CaptureDraftResetPolicy.evaluate(
            currentText: draft,
            nextText: text,
            hasLatestResult: latestResult != nil,
            hasPendingResult: pendingResultContext != nil,
            stage: stage
        )
        draft = text
        if text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            isDraftHydratedFromDailyNote = false
        }
        apply(reset)
        scheduleDraftAutosave()
    }

    func updateTrailingDraft(_ text: String) {
        let reset = CaptureDraftResetPolicy.evaluate(
            currentText: trailingDraft,
            nextText: text,
            hasLatestResult: latestResult != nil,
            hasPendingResult: pendingResultContext != nil,
            stage: stage
        )
        trailingDraft = text
        apply(reset)
        scheduleDraftAutosave()
    }

    func confirmProcessingEditInterruption() {
        guard let pendingInterruptedDraftText else {
            activeAlert = nil
            return
        }

        let reset = CaptureDraftResetOutcome(
            clearsLatestResult: latestResult != nil,
            clearsPendingResult: pendingResultContext != nil,
            stage: .idle
        )
        draft = pendingInterruptedDraftText
        self.pendingInterruptedDraftText = nil
        activeAlert = nil
        apply(reset)
        statusMessage = "Editing note"
        scheduleDraftAutosave()
    }

    func cancelProcessingEditInterruption() {
        pendingInterruptedDraftText = nil
        activeAlert = nil
    }

    func calendarStats(selectedDate: String) -> CalendarStatsSnapshot {
        CalendarStatsBuilder.makeDayStats(
            days: calendarDays,
            currentJournalDate: journal?.localDate,
            dailyStreak: dailyStreak,
            selectedDate: selectedDate
        )
    }

    func refreshContext() async {
        do {
            async let loadedSignals = VestaAPI.listSignals(limit: 24)
            async let loadedCalendarDays = VestaAPI.listCalendarDays()
            async let loadedActions = VestaAPI.listActions(limit: 24)
            async let loadedJournal = VestaAPI.getJournal(localDate: Self.localDate())

            let actionsResponse = try await loadedActions
            signals = try await loadedSignals
            calendarDays = try await loadedCalendarDays
            actions = actionsResponse.actions
            journal = try await loadedJournal
            if draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
               trailingDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                applyDailyNoteBody(journal?.bodyText)
            }
            latestRun = actionsResponse.latestRun
            let isProcessing = latestRun?.isProcessing == true
            let tracksPendingResult = pendingResultContext != nil
            if isProcessing && tracksPendingResult {
                stage = .processing
                statusMessage = "Processing in background"
            } else if let latestRun, latestRun.isFailed, tracksPendingResult {
                let completion = CaptureSaveCompletionPolicy.evaluate(
                    isProcessing: false,
                    errorCode: latestRun.errorCode
                )
                stage = completion.stage
                statusMessage = completion.statusMessage
            } else if let pendingResultContext {
                let completedSave = SavedCapture(
                    analysisRun: latestRun ?? pendingResultContext.saved.analysisRun,
                    journal: journal ?? pendingResultContext.saved.journal,
                    capture: pendingResultContext.saved.capture
                )
                latestResult = makeResult(for: pendingResultContext.noteText, saved: completedSave)
                self.pendingResultContext = nil
                stage = .saved
                statusMessage = "Saved to Vesta"
            } else if stage == .queued || stage == .processing {
                stage = .idle
                statusMessage = "Connected"
            } else {
                statusMessage = "Connected"
            }
            await refreshRetainedRows()
        } catch {
            if await applyLocalJournalFallback(localDate: Self.localDate()) {
                return
            }
            if Self.isAuthenticationRequired(error) {
                statusMessage = "Server sign-in required"
                return
            }
            statusMessage = "Engine unavailable"
        }
    }

    func pollProcessingResult() async {
        while shouldPollProcessing {
            try? await Task.sleep(nanoseconds: 2_000_000_000)
            if Task.isCancelled { return }
            await refreshContext()
        }
    }

    func addLine() {
        if attachments.isEmpty && pendingResultContext == nil {
            draft = Self.appending("Remember ", to: draft)
        } else {
            trailingDraft = Self.appending("Remember ", to: trailingDraft)
        }
        scheduleDraftAutosave()
    }

    func addJournalingSuggestion() {
        if attachments.isEmpty && pendingResultContext == nil {
            draft = Self.appending("Today, I noticed ", to: draft)
        } else {
            trailingDraft = Self.appending("Today, I noticed ", to: trailingDraft)
        }
        if pendingResultContext == nil {
            latestResult = nil
            stage = .idle
        }
        scheduleDraftAutosave()
    }

    func applyTextFormat(_ format: TextFormatAction) {
        let formatsContinuation = pendingResultContext != nil || !attachments.isEmpty
        if pendingResultContext == nil {
            latestResult = nil
            stage = .idle
        }

        let text = formatsContinuation ? trailingDraft : draft
        let formatted = Self.formatted(text, as: format)
        if formatsContinuation {
            trailingDraft = formatted
        } else {
            draft = formatted
        }
        scheduleDraftAutosave()
    }

    private static func appending(_ line: String, to text: String) -> String {
        text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            ? line
            : text + "\n" + line
    }

    private static func formatted(_ draft: String, as format: TextFormatAction) -> String {
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

    func appendDrawing(_ drawing: PKDrawing) {
        guard let attachment = CaptureAttachment.drawing(drawing) else {
            errorMessage = "Could not attach that drawing."
            return
        }
        attachments.append(attachment)
        latestResult = nil
        pendingResultContext = nil
        errorMessage = ""
        stage = .idle
    }

    func appendImage(_ image: UIImage, source: CaptureImagePickerSource) {
        appendImage(image, kind: source == .camera ? .cameraPhoto : .libraryPhoto)
    }

    func appendVoiceRecording(_ url: URL) {
        guard let attachment = CaptureAttachment.voiceRecording(url: url) else {
            errorMessage = "Could not attach that recording."
            return
        }
        attachments.append(attachment)
        latestResult = nil
        pendingResultContext = nil
        errorMessage = ""
        stage = .idle
    }

    func removeAttachment(_ attachment: CaptureAttachment) {
        attachments.removeAll { $0.id == attachment.id }
        if editingDrawing?.id == attachment.id { editingDrawing = nil }
        if previewedAttachment?.id == attachment.id { previewedAttachment = nil }
        if attachments.isEmpty, !trailingDraft.isEmpty {
            draft = [draft, trailingDraft]
                .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                .filter { !$0.isEmpty }
                .joined(separator: "\n")
            trailingDraft = ""
        }
        latestResult = nil
        pendingResultContext = nil
    }

    func openAttachment(_ attachment: CaptureAttachment) {
        if attachment.kind == .drawing, attachment.drawing != nil {
            editingDrawing = attachment
        } else {
            previewedAttachment = attachment
        }
    }

    func openLatestResult() {
        guard let latestResult else { return }
        presentedResult = latestResult
    }

    func updateDrawing(_ attachment: CaptureAttachment, drawing: PKDrawing) {
        guard let updated = CaptureAttachment.drawing(drawing, id: attachment.id),
              let index = attachments.firstIndex(where: { $0.id == attachment.id }) else {
            errorMessage = "Could not update that drawing."
            return
        }
        attachments[index] = updated
        latestResult = nil
        pendingResultContext = nil
        errorMessage = ""
        stage = .idle
    }

    func submit() async {
        let leadingText = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        let trailingText = trailingDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        let pendingNoteText = pendingResultContext?.noteText
        let previousPendingStage = stage
        let existingJournalText = draftCompositionBaseBodyText()
        let localDate = Self.localDate()
        let submission = CaptureSubmissionDraftPolicy.evaluate(
            leadingText: leadingText,
            trailingText: trailingText,
            attachmentLabels: attachments.map(\.label),
            pendingNoteText: pendingNoteText,
            existingJournalText: existingJournalText,
            treatsLeadingTextAsFullBody: isDraftHydratedFromDailyNote
        )
        guard submission.hasContent else {
            if pendingNoteText == nil {
                errorMessage = "Say or type something first."
            }
            return
        }
        guard !saving else { return }

        draftAutosaveTask?.cancel()
        let mediaAttachments = submission.includesAttachments ? attachments.map(\.journalAttachment) : []

        saving = true
        errorMessage = ""
        latestResult = nil
        statusMessage = "Saving"
        stage = .saving

        let localComposition = JournalSaveCompositionPolicy.evaluate(
            existingJournalText: existingJournalText,
            leadingNote: submission.leadingNote,
            trailingNote: submission.trailingNote,
            treatsLeadingNoteAsFullBody: isDraftHydratedFromDailyNote
        )
        var savedOnDevice = false
        if let noteSyncCoordinator {
            do {
                let localNote = try await noteSyncCoordinator.saveLocalDraft(
                    localDate: localDate,
                    title: localDate,
                    bodyText: localComposition.journalBodyText
                )
                journal = Self.journalDocument(from: localNote)
                draftAutosaveBaseBodyText = localNote.bodyText
                lastAutosavedBodyText = localNote.bodyText
                updateDailyStreak(for: localNote.localDate)
                savedOnDevice = true
                if mediaAttachments.isEmpty {
                    let optimisticRowId = completeOptimisticLocalSubmission(
                        mutationId: localNote.pendingMutationId,
                        noteText: submission.noteText,
                        pendingNoteText: pendingNoteText,
                        previousPendingStage: previousPendingStage
                    )
                    let existingJournalTextForRemoteSave = existingJournalText
                    let leadingNoteForRemoteSave = submission.leadingNote
                    let trailingNoteForRemoteSave = submission.trailingNote
                    let submittedNoteText = submission.noteText
                    let treatsRemoteNoteAsFullBody = isDraftHydratedFromDailyNote
                    Task { [noteSyncCoordinator] in
                        let receipt = await noteSyncCoordinator.syncPending()
                        self.apply(noteSyncReceipt: receipt)
                        await self.finishRemoteSubmission(
                            noteText: submittedNoteText,
                            leadingNote: leadingNoteForRemoteSave,
                            trailingNote: trailingNoteForRemoteSave,
                            attachments: [],
                            existingJournalText: existingJournalTextForRemoteSave,
                            localDate: localDate,
                            optimisticRowId: optimisticRowId,
                            treatsNoteAsFullBody: treatsRemoteNoteAsFullBody
                        )
                    }
                    return
                }
                statusMessage = "Saved on this device"
                Task { [noteSyncCoordinator] in
                    let receipt = await noteSyncCoordinator.syncPending()
                    self.apply(noteSyncReceipt: receipt)
                }
            } catch {
                savedOnDevice = false
            }
        }

        do {
            let saved = try await VestaAPI.saveDailyNote(
                submission.leadingNote,
                attachments: mediaAttachments,
                existingJournalText: existingJournalText,
                trailingNote: submission.trailingNote,
                localDate: localDate,
                treatsNoteAsFullBody: isDraftHydratedFromDailyNote
            )
            latestRun = saved.analysisRun ?? latestRun
            updateDailyStreak(for: saved.journal.localDate)
            stage = .refreshing
            await refreshContext()

            if pendingNoteText != nil {
                let transition = CaptureSubmissionTransitionPolicy.evaluate(
                    analysisRunId: pendingResultContext?.saved.analysisRun?.id,
                    currentLeadingText: leadingText,
                    submittedNoteText: submission.noteText,
                    pendingNoteText: pendingNoteText,
                    stage: previousPendingStage
                )
                if let retainedRow = transition.retainedRow {
                    appendRetainedRow(retainedRow)
                }
                draft = transition.leadingText
                trailingDraft = transition.trailingText
            }

            let result = makeResult(for: submission.noteText, saved: saved)
            let completion = CaptureSaveCompletionPolicy.evaluate(
                isProcessing: latestRun?.isProcessing == true,
                errorCode: latestRun?.isFailed == true ? latestRun?.errorCode : nil
            )
            if completion.showsResultRow {
                latestResult = result
                pendingResultContext = nil
            } else if completion.keepsResultPending {
                latestResult = nil
                pendingResultContext = PendingCaptureResultContext(noteText: submission.noteText, saved: saved)
            }
            if completion.autoPresentsDrawer {
                presentedResult = result
            }
            stage = completion.stage
            statusMessage = completion.statusMessage
        } catch {
            let failure = CaptureSubmissionFailurePolicy.evaluate(
                savedOnDevice: savedOnDevice && mediaAttachments.isEmpty,
                isTimeout: Self.isTimeout(error),
                isAuthenticationRequired: Self.isAuthenticationRequired(error),
                localizedError: error.localizedDescription
            )
            stage = failure.stage
            errorMessage = failure.errorMessage
            statusMessage = failure.statusMessage
        }

        saving = false
    }

    private func scheduleDraftAutosave() {
        guard let noteSyncCoordinator else { return }
        let baseBodyText = draftCompositionBaseBodyText()
        if draftAutosaveBaseBodyText == nil {
            draftAutosaveBaseBodyText = baseBodyText ?? ""
        }
        guard let autosave = CaptureDraftAutosavePolicy.evaluate(
            existingJournalText: baseBodyText,
            leadingDraft: draft,
            trailingDraft: trailingDraft,
            treatsLeadingDraftAsFullBody: isDraftHydratedFromDailyNote
        ) else {
            draftAutosaveTask?.cancel()
            return
        }
        guard autosave.bodyText != lastAutosavedBodyText else { return }

        let localDate = Self.localDate()
        let title = localDate
        draftAutosaveTask?.cancel()
        draftAutosaveTask = Task { [weak self, noteSyncCoordinator, bodyText = autosave.bodyText] in
            do {
                try await Task.sleep(nanoseconds: Self.draftAutosaveDelayNanoseconds)
            } catch {
                return
            }
            if Task.isCancelled { return }
            await self?.autosaveDraft(
                bodyText: bodyText,
                localDate: localDate,
                noteSyncCoordinator: noteSyncCoordinator,
                title: title
            )
        }
    }

    private func autosaveDraft(
        bodyText: String,
        localDate: String,
        noteSyncCoordinator: NoteSyncCoordinator,
        title: String
    ) async {
        do {
            let localNote = try await noteSyncCoordinator.saveLocalDraft(
                localDate: localDate,
                title: title,
                bodyText: bodyText
            )
            lastAutosavedBodyText = localNote.bodyText
            journal = Self.journalDocument(from: localNote)
            updateDailyStreak(for: localNote.localDate)
            if stage == .idle {
                statusMessage = "Saved on this device"
            }
            let receipt = await noteSyncCoordinator.syncPending()
            apply(noteSyncReceipt: receipt)
        } catch {
            statusMessage = "Saved on this device"
        }
    }

    private func apply(noteSyncReceipt receipt: NoteSyncReceipt) {
        if receipt.hasFailures {
            statusMessage = "Saved on this device"
            if let lastErrorDescription = receipt.lastErrorDescription {
                print("Vesta Convex sync failed: \(lastErrorDescription)")
            }
            return
        }

        if receipt.acceptedCount > 0, stage != .processing {
            statusMessage = "Connected"
        }
    }

    private func completeOptimisticLocalSubmission(
        mutationId: String?,
        noteText: String,
        pendingNoteText: String?,
        previousPendingStage: CaptureStage
    ) -> UUID {
        let transition = CaptureSubmissionTransitionPolicy.evaluate(
            analysisRunId: pendingResultContext?.saved.analysisRun?.id,
            currentLeadingText: draft.trimmingCharacters(in: .whitespacesAndNewlines),
            submittedNoteText: noteText,
            pendingNoteText: pendingNoteText,
            stage: previousPendingStage
        )
        if let retainedRow = transition.retainedRow {
            appendRetainedRow(retainedRow)
        }

        let optimisticRow = RetainedCaptureRow(
            mutationId: mutationId,
            noteText: noteText,
            stage: CaptureOptimisticLocalRowPolicy.evaluate()
        )
        appendRetainedRow(optimisticRow)
        attachments.removeAll()
        draft = ""
        isDraftHydratedFromDailyNote = false
        trailingDraft = ""
        latestResult = nil
        pendingResultContext = nil
        errorMessage = ""
        stage = .saved
        statusMessage = "Saved on this device"
        saving = false
        return optimisticRow.id
    }

    private func finishRemoteSubmission(
        noteText: String,
        leadingNote: String,
        trailingNote: String,
        attachments: [JournalMediaAttachment],
        existingJournalText: String?,
        localDate: String,
        optimisticRowId: UUID,
        treatsNoteAsFullBody: Bool
    ) async {
        do {
            let saved = try await VestaAPI.saveDailyNote(
                leadingNote,
                attachments: attachments,
                existingJournalText: existingJournalText,
                trailingNote: trailingNote,
                localDate: localDate,
                treatsNoteAsFullBody: treatsNoteAsFullBody
            )
            latestRun = saved.analysisRun ?? latestRun
            journal = saved.journal
            draftAutosaveBaseBodyText = saved.journal.bodyText
            lastAutosavedBodyText = saved.journal.bodyText
            updateDailyStreak(for: saved.journal.localDate)
            latestResult = makeResult(for: noteText, saved: saved)
            updateRetainedRow(
                id: optimisticRowId,
                analysisRunId: saved.analysisRun?.id,
                stage: saved.analysisRun.map(Self.stage(for:)) ?? .saved
            )
            statusMessage = "Saved to Vesta"
        } catch {
            if Self.isAuthenticationRequired(error) {
                statusMessage = "Server sign-in required"
            } else {
                statusMessage = "Saved on this device"
            }
        }
    }

    private func applyLocalJournalFallback(localDate: String) async -> Bool {
        guard let localNote = await noteSyncCoordinator?.localDailyNote(localDate: localDate) else {
            return false
        }

        applyProjectedDailyNote(LocalDailyNoteProjection(note: localNote, agentStatuses: []))
        return true
    }

    private func applyProjectedDailyNote(_ projection: LocalDailyNoteProjection) {
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

    private func applyProjectedAgentStatuses(_ statuses: [ConvexRemoteAgentStatus]) {
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

    private static func journalDocument(from localNote: LocalDailyNote) -> JournalDocument {
        JournalDocument(
            id: "local-\(localNote.localDate)",
            localDate: localNote.localDate,
            title: localNote.title,
            bodyText: localNote.bodyText,
            updatedAt: localNote.updatedAt
        )
    }

    private func appendImage(_ image: UIImage, kind: CaptureAttachmentKind) {
        guard let attachment = CaptureAttachment.image(image, kind: kind) else {
            errorMessage = "Could not attach that image."
            return
        }
        attachments.append(attachment)
        latestResult = nil
        errorMessage = ""
        stage = .idle
    }

    private func appendRetainedRow(_ row: RetainedCaptureRow) {
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

    private func updateRetainedRow(id: UUID, analysisRunId: String?, stage: CaptureStage) {
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

    private func refreshRetainedRows() async {
        var updatedRows: [RetainedCaptureRow] = []
        for row in retainedRows {
            guard (row.stage == .queued || row.stage == .processing), let analysisRunId = row.analysisRunId else {
                updatedRows.append(row)
                continue
            }
            guard let run = try? await VestaAPI.getAgentRun(runId: analysisRunId) else {
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
        retainedRows = updatedRows
    }

    private func makeResult(for text: String, saved: SavedCapture) -> CaptureResult {
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
                    subtitle: "Vesta is looking for follow-ups, commitments, and open loops.",
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
            summary: "Saved to \(saved.journal.localDate). Vesta can use this capture with the current journal, signals, and action context.",
            items: items,
            references: references
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

    private func apply(_ reset: CaptureDraftResetOutcome) {
        if reset.clearsLatestResult {
            latestResult = nil
        }
        if reset.clearsPendingResult {
            pendingResultContext = nil
        }
        stage = reset.stage
    }

    private func draftCompositionBaseBodyText() -> String? {
        if let draftAutosaveBaseBodyText {
            return draftAutosaveBaseBodyText.isEmpty ? nil : draftAutosaveBaseBodyText
        }
        return journal?.bodyText
    }

    private func applyDailyNoteBody(_ bodyText: String?) {
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

    private func updateDailyStreak(for localDate: String) {
        guard lastStreakDate != localDate else { return }
        if Self.previousLocalDate(from: localDate) == lastStreakDate {
            dailyStreak += 1
        } else {
            dailyStreak = 1
        }
        lastStreakDate = localDate
        defaults.set(dailyStreak, forKey: Self.dailyStreakKey)
        defaults.set(lastStreakDate, forKey: Self.lastStreakDateKey)
    }

    private static func previousLocalDate(from localDate: String) -> String? {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.dateFormat = "yyyy-MM-dd"
        guard let date = formatter.date(from: localDate),
              let previous = formatter.calendar.date(byAdding: .day, value: -1, to: date) else {
            return nil
        }
        return formatter.string(from: previous)
    }

    private static func localDate(_ date: Date = Date()) -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }

    private static func isTimeout(_ error: Error) -> Bool {
        (error as? URLError)?.code == .timedOut || (error as NSError).code == NSURLErrorTimedOut
    }

    private static func isAuthenticationRequired(_ error: Error) -> Bool {
        if case VestaAPIError.httpStatus(401) = error {
            return true
        }
        return false
    }

    private static func stage(for run: AgentRun) -> CaptureStage {
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

struct CaptureResult: Identifiable {
    let id = UUID()
    let title: String
    let signalCount: Int
    let actionCount: Int
    let sourceCount: Int
    let summary: String
    let items: [CaptureDetailItem]
    let references: [String]
}

struct CaptureDetailItem: Identifiable {
    let id = UUID()
    let title: String
    let value: String
    let subtitle: String
    let color: Color
    let icon: String
}
