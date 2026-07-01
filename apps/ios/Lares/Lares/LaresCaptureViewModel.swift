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

@MainActor
final class LaresCaptureViewModel: ObservableObject {
    private static let dailyStreakKey = "lares.dailyStreak"
    private static let lastStreakDateKey = "lares.lastStreakDate"
    private let defaults = UserDefaults.standard

    @Published var actions: [ActionItem] = []
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
    @Published var saving = false
    @Published var signals: [EventRecord] = []
    @Published var stage: CaptureStage = .idle
    @Published var statusMessage = "Connecting"
    @Published var trailingDraft = ""
    private var lastStreakDate: String

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
        !draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            || !trailingDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            || !attachments.isEmpty
    }

    var todayLocalDate: String {
        Self.localDate()
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
            if latestRun?.isProcessing == true {
                stage = .processing
            } else if stage == .processing {
                stage = .idle
            }
            statusMessage = "Connected"
        } catch {
            statusMessage = "Engine unavailable"
        }
    }

    func addLine() {
        if attachments.isEmpty {
            draft = Self.appending("Remember ", to: draft)
        } else {
            trailingDraft = Self.appending("Remember ", to: trailingDraft)
        }
    }

    func addJournalingSuggestion() {
        if attachments.isEmpty {
            draft = Self.appending("Today, I noticed ", to: draft)
        } else {
            trailingDraft = Self.appending("Today, I noticed ", to: trailingDraft)
        }
        latestResult = nil
        stage = .idle
    }

    func applyTextFormat(_ format: TextFormatAction) {
        latestResult = nil
        stage = .idle

        let text = attachments.isEmpty ? draft : trailingDraft
        let formatted = Self.formatted(text, as: format)
        if attachments.isEmpty {
            draft = formatted
        } else {
            trailingDraft = formatted
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
    }

    func openAttachment(_ attachment: CaptureAttachment) {
        if attachment.kind == .drawing, attachment.drawing != nil {
            editingDrawing = attachment
        } else {
            previewedAttachment = attachment
        }
    }

    func updateDrawing(_ attachment: CaptureAttachment, drawing: PKDrawing) {
        guard let updated = CaptureAttachment.drawing(drawing, id: attachment.id),
              let index = attachments.firstIndex(where: { $0.id == attachment.id }) else {
            errorMessage = "Could not update that drawing."
            return
        }
        attachments[index] = updated
        latestResult = nil
        errorMessage = ""
        stage = .idle
    }

    func submit() async {
        let leadingText = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        let trailingText = trailingDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !leadingText.isEmpty || !trailingText.isEmpty || !attachments.isEmpty else {
            errorMessage = "Say or type something first."
            return
        }
        guard !saving else { return }

        let typedText = [leadingText, trailingText]
            .filter { !$0.isEmpty }
            .joined(separator: "\n\n")
        let noteText = typedText.isEmpty
            ? attachments.map(\.label).joined(separator: "\n")
            : typedText
        let leadingNote = typedText.isEmpty ? noteText : leadingText
        let mediaAttachments = attachments.map(\.journalAttachment)

        saving = true
        errorMessage = ""
        latestResult = nil
        statusMessage = "Saving"
        stage = .saving

        do {
            let saved = try await LaresAPI.saveDailyNote(
                leadingNote,
                attachments: mediaAttachments,
                trailingNote: trailingText,
                localDate: Self.localDate()
            )
            latestRun = saved.analysisRun ?? latestRun
            updateDailyStreak(for: saved.journal.localDate)
            stage = .refreshing
            await refreshContext()

            let result = makeResult(for: noteText, saved: saved)
            latestResult = result
            presentedResult = result
            stage = latestRun?.isProcessing == true ? .processing : .saved
            statusMessage = "Saved to Lares"
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
}

enum CaptureStage: Equatable {
    case idle
    case saving
    case refreshing
    case processing
    case saved

    var label: String? {
        switch self {
        case .idle:
            nil
        case .saving:
            "Saving"
        case .refreshing:
            "Updating context"
        case .processing:
            "Processing"
        case .saved:
            "Saved"
        }
    }

    var isWorking: Bool {
        switch self {
        case .saving, .refreshing, .processing:
            true
        case .idle, .saved:
            false
        }
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
