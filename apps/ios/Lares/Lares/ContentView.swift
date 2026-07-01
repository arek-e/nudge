import AppIntents
import SwiftUI

struct ContentView: View {
    @StateObject private var model = LaresCaptureViewModel()
    @Environment(\.scenePhase) private var scenePhase
    @FocusState private var captureFocused: Bool
    @State private var settingsOpen = false

    var body: some View {
        ZStack {
            Color.laresCanvas.ignoresSafeArea()
            LinearGradient(
                colors: [
                    Color.laresSurface.opacity(0.58),
                    Color.laresCanvas,
                    Color.laresCanvas
                ],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()

            VStack(spacing: 0) {
                TopChrome(dailyStreak: model.dailyStreak, settingsOpen: $settingsOpen)
                    .padding(.horizontal, 24)
                    .padding(.top, 14)

                CaptureCanvas(model: model, focused: $captureFocused)
                    .padding(.horizontal, 26)
                    .padding(.top, 48)

                Spacer(minLength: 0)
            }
        }
        .safeAreaInset(edge: .bottom) {
            BottomCaptureRail(
                hasDraft: model.hasDraft,
                latestResult: model.latestResult,
                saving: model.saving,
                focusInput: { captureFocused = true },
                addLine: { model.addLine() },
                submit: { Task { await model.submit() } }
            )
            .padding(.horizontal, 24)
            .padding(.bottom, 14)
        }
        .preferredColorScheme(.dark)
        .task { await model.refreshContext() }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active {
                Task { await model.refreshContext() }
            }
        }
        .sheet(item: $model.presentedResult) { result in
            CaptureDetailSheet(result: result)
                .presentationDetents([.fraction(0.72), .large])
                .presentationDragIndicator(.hidden)
        }
        .sheet(isPresented: $settingsOpen) {
            BackendSettingsSheet(
                status: model.statusMessage,
                refresh: { Task { await model.refreshContext() } }
            )
            .presentationDetents([.medium])
        }
    }
}

@MainActor
final class LaresCaptureViewModel: ObservableObject {
    private static let dailyStreakKey = "lares.dailyStreak"
    private static let lastStreakDateKey = "lares.lastStreakDate"
    private let defaults = UserDefaults.standard

    @Published var actions: [ActionItem] = []
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

    func refreshContext() async {
        do {
            async let loadedSignals = LaresAPI.listSignals(limit: 24)
            async let loadedActions = LaresAPI.listActions(limit: 24)
            async let loadedJournal = LaresAPI.getJournal(localDate: Self.localDate())

            let actionsResponse = try await loadedActions
            signals = try await loadedSignals
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
            statusMessage = "Backend unavailable"
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
                subtitle: "Updated on the backend.",
                color: .laresAmber,
                icon: "doc.text.fill"
            ),
            CaptureDetailItem(
                title: "Capture",
                value: saved.capture?.source.displayLabel ?? "Journal",
                subtitle: saved.capture?.type.displayLabel ?? "Saved for background review",
                color: .laresBlue,
                icon: "tray.and.arrow.down.fill"
            )
        ]

        if actionTotal > 0 {
            items.append(
                CaptureDetailItem(
                    title: "Open actions",
                    value: "\(actionTotal)",
                    subtitle: "Current actions remain available for follow-up.",
                    color: .laresMint,
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
                    color: .laresPurple,
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

struct TopChrome: View {
    let dailyStreak: Int
    @Binding var settingsOpen: Bool

    var body: some View {
        HStack(alignment: .center) {
            LaresLogo()
                .frame(width: 104, alignment: .leading)

            Spacer()

            Text("Today")
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(Color.laresInk)
                .padding(.horizontal, 18)
                .frame(height: 38)
                .background(Color.laresSurface.opacity(0.94), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(Color.laresStroke, lineWidth: 1))
                .shadow(color: .laresShadow, radius: 12, y: 8)

            Spacer()

            Button {
                settingsOpen = true
            } label: {
                HStack(spacing: 9) {
                    Image(systemName: "flame.fill")
                        .foregroundStyle(Color.laresAmber)
                    Text(dailyStreak > 0 ? "\(dailyStreak) day" : "Start")
                        .lineLimit(1)
                        .minimumScaleFactor(0.72)
                    Image(systemName: "gearshape.fill")
                }
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(Color.laresInk)
                .padding(.horizontal, 13)
                .frame(height: 38)
                .background(Color.laresSurface.opacity(0.94), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(Color.laresStroke, lineWidth: 1))
                .shadow(color: .laresShadow, radius: 12, y: 8)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Settings")
        }
    }
}

struct LaresLogo: View {
    var body: some View {
        HStack(spacing: 8) {
            ZStack {
                RoundedRectangle(cornerRadius: 7, style: .continuous)
                    .fill(Color.laresSurface.opacity(0.95))
                RoundedRectangle(cornerRadius: 7, style: .continuous)
                    .stroke(Color.laresStroke, lineWidth: 1)
                Text("L")
                    .font(.system(size: 14, weight: .semibold, design: .monospaced))
                    .foregroundStyle(Color.laresInk)
                Rectangle()
                    .fill(Color.laresMint)
                    .frame(width: 10, height: 2)
                    .offset(y: 9)
            }
            .frame(width: 28, height: 28)

            Text("Lares")
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(Color.laresInk)
        }
    }
}

struct CaptureCanvas: View {
    @ObservedObject var model: LaresCaptureViewModel
    var focused: FocusState<Bool>.Binding

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            ZStack(alignment: .topLeading) {
                TextField("What matters now?", text: $model.draft, axis: .vertical)
                    .focused(focused)
                    .submitLabel(.done)
                    .onSubmit { Task { await model.submit() } }
                    .lineLimit(1...5)
                    .textInputAutocapitalization(.sentences)
                    .autocorrectionDisabled(false)
                    .font(.system(size: 25, weight: .semibold, design: .rounded))
                    .foregroundStyle(model.stage.isWorking && model.hasDraft ? Color.clear : Color.laresInk)
                    .fixedSize(horizontal: false, vertical: true)

                if model.stage.isWorking && model.hasDraft {
                    ShimmeringNoteText(text: model.draft)
                        .allowsHitTesting(false)
                }
            }

            HStack {
                Spacer(minLength: 0)
                StatusChip(stage: model.stage, result: model.latestResult)
            }
            .frame(minHeight: 22)

            if !model.errorMessage.isEmpty {
                Text(model.errorMessage)
                    .font(.system(size: 13, weight: .medium, design: .rounded))
                    .foregroundStyle(Color.laresPink)
                    .padding(.horizontal, 2)
            }
        }
        .frame(maxWidth: .infinity, alignment: .topLeading)
    }
}

struct StatusChip: View {
    let stage: CaptureStage
    let result: CaptureResult?

    var body: some View {
        Group {
            if let label = stage.label {
                HStack(spacing: 7) {
                    if stage == .saved {
                        Image(systemName: "sparkles")
                            .foregroundStyle(Color.laresPurple)
                    }

                    if stage.isWorking {
                        ShimmeringStatusText(text: label)
                    } else {
                        Text(label)
                            .font(.system(size: 16, weight: .semibold, design: .rounded))
                            .foregroundStyle(stage == .saved ? Color.laresInk : Color.laresMuted)
                    }
                }
            } else if let result {
                Text("\(result.signalCount) signal")
                    .font(.system(size: 16, weight: .semibold, design: .rounded))
                    .foregroundStyle(Color.laresMuted)
            }
        }
        .lineLimit(1)
        .fixedSize(horizontal: true, vertical: false)
    }
}

struct ShimmeringStatusText: View {
    let text: String

    var body: some View {
        LaresShimmeringText(
            text: text,
            font: .system(size: 16, weight: .semibold, design: .rounded),
            textColor: Color.laresMuted,
            highlightColor: Color.white.opacity(0.16),
            maxLines: 1,
            duration: 1.5
        )
        .fixedSize(horizontal: true, vertical: false)
    }
}

struct ShimmeringNoteText: View {
    let text: String

    var body: some View {
        LaresShimmeringText(
            text: text,
            font: .system(size: 25, weight: .semibold, design: .rounded),
            textColor: Color.laresInk,
            highlightColor: Color.white.opacity(0.32),
            maxLines: 5,
            duration: 1.35
        )
    }
}

struct LaresShimmeringText: View {
    let text: String
    let font: Font
    let textColor: Color
    let highlightColor: Color
    let maxLines: Int
    let duration: TimeInterval

    var body: some View {
        TimelineView(.animation) { context in
            let phase = context.date.timeIntervalSinceReferenceDate
                .truncatingRemainder(dividingBy: duration) / duration

            Text(text)
                .font(font)
                .foregroundStyle(textColor)
                .lineLimit(maxLines)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
                .overlay(alignment: .topLeading) {
                    GeometryReader { geometry in
                        shimmer(in: geometry, phase: phase)
                    }
                    .mask(mask)
                    .blendMode(.plusLighter)
                }
        }
    }

    private var mask: some View {
        Text(text)
            .font(font)
            .lineLimit(maxLines)
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func shimmer(in geometry: GeometryProxy, phase: Double) -> some View {
        let bandWidth = max(geometry.size.width * 0.55, 84)

        return LinearGradient(
            colors: [.clear, highlightColor, .clear],
            startPoint: .leading,
            endPoint: .trailing
        )
        .frame(width: bandWidth, height: geometry.size.height)
        .offset(x: -bandWidth + phase * (geometry.size.width + bandWidth))
    }
}

struct BottomCaptureRail: View {
    let hasDraft: Bool
    let latestResult: CaptureResult?
    let saving: Bool
    let focusInput: () -> Void
    let addLine: () -> Void
    let submit: () -> Void

    var body: some View {
        HStack(spacing: 14) {
            if let latestResult {
                ResultMetricRail(result: latestResult)
            } else {
                Button(action: hasDraft ? submit : focusInput) {
                    HStack(spacing: 8) {
                        Image(systemName: hasDraft ? "checkmark" : "sparkle.magnifyingglass")
                            .foregroundStyle(Color.laresMint)
                        Text(hasDraft ? "Submit note" : "Log what matters")
                            .foregroundStyle(Color.laresInk)
                            .lineLimit(1)
                            .minimumScaleFactor(0.72)
                    }
                    .font(.system(size: 16, weight: .semibold, design: .rounded))
                    .frame(minWidth: 186, minHeight: 48)
                    .background(Color.laresSurfaceStrong.opacity(0.96), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(Color.laresStroke, lineWidth: 1))
                    .shadow(color: .laresShadow, radius: 14, y: 10)
                }
                .buttonStyle(.plain)

                Spacer(minLength: 0)

                RailButton(systemName: "mic.fill", color: .laresBlue, action: focusInput)
                RailButton(systemName: "plus", color: .laresAmber, action: addLine)
                if hasDraft || saving {
                    RailButton(systemName: saving ? "hourglass" : "checkmark", color: .laresInk, action: submit)
                        .transition(.scale(scale: 0.82).combined(with: .opacity))
                }
            }
        }
        .frame(maxWidth: 430)
        .animation(.spring(response: 0.24, dampingFraction: 0.82), value: hasDraft)
        .animation(.spring(response: 0.24, dampingFraction: 0.82), value: saving)
    }
}

struct RailButton: View {
    let systemName: String
    let color: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(.system(size: 20, weight: .semibold))
                .foregroundStyle(color)
                .frame(width: 48, height: 48)
                .background(Color.laresSurfaceStrong.opacity(0.96), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(Color.laresStroke, lineWidth: 1))
                .shadow(color: .laresShadow, radius: 14, y: 10)
        }
        .buttonStyle(.plain)
    }
}

struct ResultMetricRail: View {
    let result: CaptureResult

    var body: some View {
        HStack(spacing: 10) {
            RailMetric(icon: "checkmark", text: "Saved", color: .laresMint)
            RailDivider()
            RailMetric(text: "\(result.signalCount) signals", color: .laresPink)
            RailDivider()
            RailMetric(text: "\(result.actionCount) open", color: .laresPurple)
            RailDivider()
            RailMetric(icon: "link", text: "\(result.sourceCount)", color: .laresBlue)
        }
        .font(.system(size: 14, weight: .semibold, design: .rounded))
        .padding(.horizontal, 18)
        .frame(minHeight: 54)
        .background(Color.laresSurfaceStrong.opacity(0.96), in: Capsule())
        .shadow(color: .laresShadow, radius: 18, y: 10)
    }
}

struct RailMetric: View {
    var icon: String?
    let text: String
    let color: Color

    var body: some View {
        HStack(spacing: 5) {
            if let icon {
                Image(systemName: icon)
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(color)
            } else {
                Circle()
                    .fill(color)
                    .frame(width: 6, height: 6)
            }
            Text(text)
                .foregroundStyle(Color.laresInk)
        }
    }
}

struct RailDivider: View {
    var body: some View {
        Circle()
            .fill(Color.laresMuted.opacity(0.22))
            .frame(width: 4, height: 4)
    }
}

struct CaptureDetailSheet: View {
    let result: CaptureResult
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: 18) {
                Capsule()
                    .fill(Color.laresMuted.opacity(0.32))
                    .frame(width: 42, height: 5)
                    .frame(maxWidth: .infinity)
                    .padding(.top, 8)

                HStack(alignment: .center) {
                    Text("Capture saved")
                        .font(.system(size: 18, weight: .bold, design: .rounded))
                        .foregroundStyle(Color.laresInk)

                    Spacer()

                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 13, weight: .bold))
                            .foregroundStyle(Color.laresInk)
                            .frame(width: 34, height: 34)
                            .background(Color.laresSurface, in: Circle())
                    }
                    .buttonStyle(.plain)
                }

                Text(result.title)
                    .font(.system(size: 25, weight: .heavy, design: .rounded))
                    .foregroundStyle(Color.laresInk)
                    .lineLimit(3)
                    .fixedSize(horizontal: false, vertical: true)

                CaptureHeroCard(result: result)

                SheetSectionTitle("Items")

                VStack(spacing: 10) {
                    ForEach(result.items) { item in
                        DetailItemRow(item: item)
                    }
                }

                SheetSectionTitle("Context")

                ContextSummaryCard(result: result)

                SheetSectionTitle("References")

                ReferenceRow(result: result)
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 32)
        }
        .background(Color.laresCanvas.ignoresSafeArea())
        .preferredColorScheme(.dark)
    }
}

struct CaptureHeroCard: View {
    let result: CaptureResult

    var body: some View {
        VStack(spacing: 18) {
            HStack(alignment: .firstTextBaseline, spacing: 10) {
                Image(systemName: "checkmark.seal.fill")
                    .font(.system(size: 26, weight: .bold))
                    .foregroundStyle(Color.laresMint)
                Text("Saved")
                    .font(.system(size: 40, weight: .heavy, design: .rounded))
                    .foregroundStyle(Color.laresInk)
                Text("for Lares")
                    .font(.system(size: 16, weight: .semibold, design: .rounded))
                    .foregroundStyle(Color.laresMuted)
            }

            HStack(spacing: 0) {
                HeroMetric(value: "\(result.signalCount)", label: "Signals", color: .laresPink)
                HeroMetric(value: "\(result.actionCount)", label: "Open actions", color: .laresPurple)
                HeroMetric(value: "\(result.sourceCount)", label: "References", color: .laresBlue)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(20)
        .background(Color.laresSurface.opacity(0.94), in: RoundedRectangle(cornerRadius: 24, style: .continuous))
        .shadow(color: .laresShadow.opacity(0.65), radius: 24, y: 10)
    }
}

struct HeroMetric: View {
    let value: String
    let label: String
    let color: Color

    var body: some View {
        VStack(spacing: 6) {
            Text(value)
                .font(.system(size: 17, weight: .bold, design: .rounded))
                .foregroundStyle(Color.laresInk)
            HStack(spacing: 5) {
                Circle()
                    .fill(color)
                    .frame(width: 6, height: 6)
                Text(label)
                    .font(.system(size: 12, weight: .semibold, design: .rounded))
                    .foregroundStyle(Color.laresMuted)
                    .lineLimit(1)
                    .minimumScaleFactor(0.82)
            }
        }
        .frame(maxWidth: .infinity)
    }
}

struct SheetSectionTitle: View {
    let title: String

    init(_ title: String) {
        self.title = title
    }

    var body: some View {
        Text(title)
            .font(.system(size: 17, weight: .bold, design: .rounded))
            .foregroundStyle(Color.laresMuted)
            .padding(.top, 4)
    }
}

struct DetailItemRow: View {
    let item: CaptureDetailItem

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: item.icon)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(item.color)
                .frame(width: 34, height: 34)
                .background(item.color.opacity(0.12), in: Circle())

            VStack(alignment: .leading, spacing: 3) {
                Text(item.title)
                    .font(.system(size: 16, weight: .semibold, design: .rounded))
                    .foregroundStyle(Color.laresInk)
                Text(item.subtitle)
                    .font(.system(size: 12, weight: .medium, design: .rounded))
                    .foregroundStyle(Color.laresMuted)
                    .lineLimit(2)
            }

            Spacer(minLength: 8)

            Text(item.value)
                .font(.system(size: 15, weight: .bold, design: .rounded))
                .foregroundStyle(Color.laresInk)
                .lineLimit(1)
                .minimumScaleFactor(0.72)

        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(Color.laresSurface.opacity(0.94), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .shadow(color: .laresShadow.opacity(0.45), radius: 16, y: 7)
    }
}

struct ContextSummaryCard: View {
    let result: CaptureResult

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(result.summary)
                .font(.system(size: 16, weight: .medium, design: .rounded))
                .foregroundStyle(Color.laresInk)
                .lineSpacing(3)
        }
        .padding(18)
        .background(Color.laresSurface.opacity(0.94), in: RoundedRectangle(cornerRadius: 22, style: .continuous))
        .shadow(color: .laresShadow.opacity(0.45), radius: 18, y: 8)
    }
}

struct ReferenceRow: View {
    let result: CaptureResult

    var body: some View {
        HStack(spacing: 8) {
            ForEach(result.references, id: \.self) { reference in
                Text(reference)
                    .font(.system(size: 13, weight: .semibold, design: .rounded))
                    .foregroundStyle(Color.laresInk)
                    .padding(.horizontal, 12)
                    .frame(height: 34)
                    .background(Color.laresSurfaceStrong.opacity(0.92), in: Capsule())
            }

            Spacer(minLength: 0)

            Text("\(result.sourceCount) sources")
                .font(.system(size: 13, weight: .bold, design: .rounded))
                .foregroundStyle(Color.laresPurple)
        }
    }
}

struct BackendSettingsSheet: View {
    @AppStorage(LaresAPI.backendURLKey) private var backendURL = LaresAPI.defaultBackendURL
    let status: String
    let refresh: () -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack {
                Text("Backend")
                    .font(.system(size: 24, weight: .heavy, design: .rounded))
                    .foregroundStyle(Color.laresInk)
                Spacer()
                Button {
                    dismiss()
                } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(Color.laresInk)
                        .frame(width: 34, height: 34)
                        .background(Color.laresSurface, in: Circle())
                }
                .buttonStyle(.plain)
            }

            VStack(alignment: .leading, spacing: 8) {
                Text("Development server")
                    .font(.system(size: 13, weight: .bold, design: .rounded))
                    .foregroundStyle(Color.laresMuted)
                TextField("URL", text: $backendURL)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .keyboardType(.URL)
                    .font(.system(size: 16, weight: .semibold, design: .rounded))
                    .foregroundStyle(Color.laresInk)
                    .padding(.horizontal, 14)
                    .frame(height: 48)
                    .background(Color.laresSurfaceStrong, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            }

            HStack {
                Text(status)
                    .font(.system(size: 15, weight: .semibold, design: .rounded))
                    .foregroundStyle(Color.laresMuted)
                Spacer()
                Button("Refresh", action: refresh)
                    .font(.system(size: 15, weight: .bold, design: .rounded))
                    .foregroundStyle(Color.laresPurple)
            }

            VStack(alignment: .leading, spacing: 12) {
                Text("Siri")
                    .font(.system(size: 13, weight: .bold, design: .rounded))
                    .foregroundStyle(Color.laresMuted)
                Text("Say “Hey Siri, Tell Layers”.")
                    .font(.system(size: 18, weight: .heavy, design: .rounded))
                    .foregroundStyle(Color.laresInk)
                SiriTipView(intent: LogVoiceIntent())
                    .siriTipViewStyle(.dark)
                ShortcutsLink()
                    .shortcutsLinkStyle(.dark)
                Text("If Siri still misses the app name, add a personal shortcut named “Log this”.")
                    .font(.system(size: 13, weight: .semibold, design: .rounded))
                    .foregroundStyle(Color.laresMuted)
                    .lineSpacing(2)
            }

            Spacer()
        }
        .padding(22)
        .background(Color.laresCanvas.ignoresSafeArea())
        .preferredColorScheme(.dark)
    }
}

extension Color {
    static let laresAmber = Color(red: 0.94, green: 0.57, blue: 0.19)
    static let laresBlue = Color(red: 0.34, green: 0.62, blue: 0.96)
    static let laresBlush = Color(red: 0.09, green: 0.08, blue: 0.1)
    static let laresCanvas = Color(red: 0.035, green: 0.039, blue: 0.043)
    static let laresInk = Color(red: 0.93, green: 0.92, blue: 0.88)
    static let laresMint = Color(red: 0.25, green: 0.78, blue: 0.58)
    static let laresMuted = Color(red: 0.48, green: 0.5, blue: 0.53)
    static let laresPink = Color(red: 0.84, green: 0.37, blue: 0.52)
    static let laresPurple = Color(red: 0.55, green: 0.46, blue: 0.92)
    static let laresShadow = Color.black.opacity(0.24)
    static let laresStroke = Color.white.opacity(0.07)
    static let laresSurface = Color(red: 0.075, green: 0.084, blue: 0.094)
    static let laresSurfaceStrong = Color(red: 0.12, green: 0.13, blue: 0.145)
}

struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView()
    }
}

private extension String {
    var displayLabel: String {
        replacingOccurrences(of: "_", with: " ")
            .split(separator: " ")
            .map { $0.prefix(1).uppercased() + $0.dropFirst() }
            .joined(separator: " ")
    }
}
