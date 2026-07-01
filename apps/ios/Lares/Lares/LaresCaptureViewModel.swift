import SwiftUI

@MainActor
final class LaresCaptureViewModel: ObservableObject {
    private static let dailyStreakKey = "lares.dailyStreak"
    private static let lastStreakDateKey = "lares.lastStreakDate"
    private let defaults = UserDefaults.standard

    @Published var actions: [ActionItem] = []
    @Published var calendarDays: [CalendarDayStats] = []
    @Published private(set) var dailyStreak: Int
    @Published var draft = ""
    @Published var errorMessage = ""
    @Published var journal: JournalDocument?
    @Published var latestRun: AgentRun?
    @Published var latestResult: CaptureResult?
    @Published var presentedResult: CaptureResult?
    @Published var saving = false
    @Published var signals: [EventRecord] = []
    @Published var stage: CaptureStage = .idle
    @Published var statusMessage = "Connecting"
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
        if draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            draft = "Remember "
        } else {
            draft.append("\n")
        }
    }

    func submit() async {
        let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else {
            errorMessage = "Say or type something first."
            return
        }
        guard !saving else { return }

        saving = true
        errorMessage = ""
        latestResult = nil
        statusMessage = "Saving"
        stage = .saving

        do {
            let saved = try await LaresAPI.saveDailyNote(text, localDate: Self.localDate())
            latestRun = saved.analysisRun ?? latestRun
            updateDailyStreak(for: saved.journal.localDate)
            stage = .refreshing
            await refreshContext()

            let result = makeResult(for: text, saved: saved)
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
