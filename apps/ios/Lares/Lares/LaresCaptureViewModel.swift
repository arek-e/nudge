import PencilKit
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
        let prepared = image.laresPreparedForUpload(maxDimension: 1600)
        guard let data = prepared.jpegData(compressionQuality: 0.82) else { return nil }
        return CaptureAttachment(
            id: UUID().uuidString,
            kind: kind,
            drawing: nil,
            mimeType: "image/jpeg",
            dataURL: "data:image/jpeg;base64,\(data.base64EncodedString())",
            thumbnail: prepared.laresPreparedForUpload(maxDimension: 360)
        )
    }

    static func drawing(_ drawing: PKDrawing, id: String = UUID().uuidString) -> CaptureAttachment? {
        let bounds = drawing.bounds.insetBy(dx: -36, dy: -36)
        guard !bounds.isEmpty else { return nil }
        let image = drawing.image(from: bounds, scale: UIScreen.main.scale)
        let prepared = image.laresScaled(maxDimension: 1600)
        guard let data = prepared.pngData() else { return nil }

        return CaptureAttachment(
            id: id,
            kind: .drawing,
            drawing: drawing,
            mimeType: "image/png",
            dataURL: "data:image/png;base64,\(data.base64EncodedString())",
            thumbnail: prepared.laresScaled(maxDimension: 360)
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
final class LaresCaptureViewModel: ObservableObject {
    private static let dailyStreakKey = "lares.dailyStreak"
    private static let lastStreakDateKey = "lares.lastStreakDate"
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
    @Published var presentedResult: CaptureResult?
    @Published var previewedAttachment: CaptureAttachment?
    @Published var editingDrawing: CaptureAttachment?
    @Published var retainedRows: [RetainedCaptureRow] = []
    @Published var saving = false
    @Published var signals: [EventRecord] = []
    @Published var stage: CaptureStage = .idle
    @Published var statusMessage = "Connecting"
    @Published var trailingDraft = ""
    private var lastStreakDate: String
    private var pendingInterruptedDraftText: String?
    private var pendingResultContext: PendingCaptureResultContext?

    init() {
        dailyStreak = defaults.integer(forKey: Self.dailyStreakKey)
        lastStreakDate = defaults.string(forKey: Self.lastStreakDateKey) ?? ""
    }

    var openLoopCount: Int {
        actions.filter { action in
            action.status == "proposed" || action.status == "accepted"
        }.count
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
        pendingResultContext != nil && stage == .processing
    }

    var shouldPollProcessing: Bool {
        (pendingResultContext != nil && stage == .processing)
            || retainedRows.contains { $0.stage == .processing }
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
        apply(reset)
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
            async let loadedSignals = LaresAPI.listSignals(limit: 24)
            async let loadedCalendarDays = LaresAPI.listCalendarDays()
            async let loadedActions = LaresAPI.listActions(limit: 24)
            async let loadedJournal = LaresAPI.getJournal(localDate: Self.localDate())

            let actionsResponse = try await loadedActions
            signals = try await loadedSignals
            calendarDays = try await loadedCalendarDays
            actions = actionsResponse.actions
            journal = try await loadedJournal
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
                statusMessage = "Saved to Lares"
            } else if stage == .processing {
                stage = .idle
                statusMessage = "Connected"
            } else {
                statusMessage = "Connected"
            }
            await refreshRetainedRows()
        } catch {
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
        let existingJournalText = journal?.bodyText
        let submission = CaptureSubmissionDraftPolicy.evaluate(
            leadingText: leadingText,
            trailingText: trailingText,
            attachmentLabels: attachments.map(\.label),
            pendingNoteText: pendingNoteText
        )
        guard submission.hasContent else {
            if pendingNoteText == nil {
                errorMessage = "Say or type something first."
            }
            return
        }
        guard !saving else { return }

        let mediaAttachments = submission.includesAttachments ? attachments.map(\.journalAttachment) : []

        saving = true
        errorMessage = ""
        latestResult = nil
        statusMessage = "Saving"
        stage = .saving

        do {
            let saved = try await LaresAPI.saveDailyNote(
                submission.leadingNote,
                attachments: mediaAttachments,
                existingJournalText: existingJournalText,
                trailingNote: submission.trailingNote,
                localDate: Self.localDate()
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
            if Self.isTimeout(error) {
                stage = .processing
                errorMessage = ""
                statusMessage = "Processing in background"
            } else {
                stage = .idle
                errorMessage = error.localizedDescription
                statusMessage = "Save failed"
            }
        }

        saving = false
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
            if let analysisRunId = row.analysisRunId {
                return retainedRow.analysisRunId == analysisRunId
            }
            return retainedRow.noteText == row.noteText && retainedRow.stage == row.stage
        }) else {
            return
        }
        retainedRows.append(row)
    }

    private func refreshRetainedRows() async {
        var updatedRows: [RetainedCaptureRow] = []
        for row in retainedRows {
            guard row.stage == .processing, let analysisRunId = row.analysisRunId else {
                updatedRows.append(row)
                continue
            }
            guard let run = try? await LaresAPI.getAgentRun(runId: analysisRunId) else {
                updatedRows.append(row)
                continue
            }
            updatedRows.append(
                RetainedCaptureRow(
                    id: row.id,
                    analysisRunId: row.analysisRunId,
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
                    subtitle: "Lares is looking for follow-ups, commitments, and open loops.",
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
            summary: "Saved to \(saved.journal.localDate). Lares can use this capture with the current journal, signals, and action context.",
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

    private static func stage(for run: AgentRun) -> CaptureStage {
        if run.isProcessing { return .processing }
        if run.isFailed {
            return run.errorCode == "AI_EXTRACTION_TIMEOUT" ? .analysisTimedOut : .analysisFailed
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
