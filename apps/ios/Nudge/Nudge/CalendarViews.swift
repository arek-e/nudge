import ComposableArchitecture
import HorizonCalendar
import SwiftUI
import UIKit

private enum CalendarStatsScope: String, CaseIterable, Identifiable {
    case month = "Month"
    case week = "Week"
    case day = "Day"

    var id: String { rawValue }
}

struct TodayCalendarScreen: View {
    let store: StoreOf<NudgeCaptureFeature>
    @State private var scope = CalendarStatsScope.day
    @State private var selectedDate: String

    init(store: StoreOf<NudgeCaptureFeature>) {
        self.store = store
        _selectedDate = State(initialValue: store.todayLocalDate)
    }

    var body: some View {
        let snapshot = CalendarStatsBuilder.makeDayStats(
            days: store.calendarDays,
            currentJournalDate: store.journal?.localDate,
            dailyStreak: store.dailyStreak,
            selectedDate: selectedDate
        )

        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: 18) {
                CalendarDateHeader(
                    selectedDate: selectedDate,
                    hasActivity: snapshot.selectedDay.hasActivity,
                    previousDay: { selectedDate = CalendarFormatting.offset(selectedDate, by: -1) },
                    nextDay: { selectedDate = CalendarFormatting.offset(selectedDate, by: 1) },
                    dismiss: nil
                )
                .padding(.top, 18)

                Picker("View", selection: $scope) {
                    ForEach(CalendarStatsScope.allCases) { scope in
                        Text(scope.rawValue).tag(scope)
                    }
                }
                .pickerStyle(.segmented)

                Group {
                    switch scope {
                    case .month:
                        NudgeActivityCalendar(
                            snapshot: snapshot,
                            selectedDate: $selectedDate,
                            today: store.todayLocalDate
                        )
                        .frame(height: 410)
                    case .week:
                        WeekStatsView(snapshot: snapshot, selectedDate: selectedDate)
                    case .day:
                        DailyCalendarTimelineView(
                            snapshot: snapshot,
                            selectedDate: $selectedDate,
                            today: store.todayLocalDate
                        )
                    }
                }

                if scope != .day {
                    SelectedDayStatsView(day: snapshot.selectedDay)
                }
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 32)
        }
        .task { await store.send(.refreshContext).finish() }
        .background(Color.appBackground.ignoresSafeArea())
        .navigationTitle("Calendar")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(Color.appBackground, for: .navigationBar)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .preferredColorScheme(.dark)
    }
}

struct DailyReviewScreen: View {
    let store: StoreOf<NudgeCaptureFeature>

    var body: some View {
        let snapshot = store.dailyReviewSnapshot

        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: 18) {
                DailyReviewHeader(snapshot: snapshot)
                    .padding(.top, 18)

                SyncStatusMatrixView(snapshot: snapshot.syncStatus)
                    .frame(maxWidth: .infinity)

                DailyReviewMetricGrid(rows: snapshot.metricRows)

                if snapshot.hasContent {
                    if !snapshot.noteRows.isEmpty {
                        DailyReviewSection(title: "Notes", count: snapshot.noteRows.count) {
                            ForEach(snapshot.noteRows) { row in
                                DailyReviewNoteCard(row: row)
                            }
                        }
                    }

                    if !snapshot.openActionRows.isEmpty {
                        DailyReviewSection(title: "Open actions", count: snapshot.openActionRows.count) {
                            ForEach(snapshot.openActionRows) { row in
                                DailyReviewActionCard(row: row)
                            }
                        }
                    }

                    if !snapshot.signalRows.isEmpty {
                        DailyReviewSection(title: "Signals", count: snapshot.signalRows.count) {
                            ForEach(snapshot.signalRows) { row in
                                DailyReviewSignalCard(row: row)
                            }
                        }
                    }
                } else {
                    DailyReviewEmptyCard(localDate: snapshot.localDate)
                }
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 34)
        }
        .task { await store.send(.refreshContext).finish() }
        .background(Color.appBackground.ignoresSafeArea())
        .navigationTitle("Daily Review")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(Color.appBackground, for: .navigationBar)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .preferredColorScheme(.dark)
    }
}

private struct DailyReviewHeader: View {
    let snapshot: DailyReviewSnapshot

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(CalendarFormatting.title(for: snapshot.localDate))
                .font(.system(size: 30, weight: .heavy, design: .rounded))
                .foregroundStyle(Color.textPrimary)
                .lineLimit(2)
                .minimumScaleFactor(0.78)

            HStack(spacing: 8) {
                Image(systemName: "doc.text.magnifyingglass")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Color.accentInsight)
                Text(snapshot.title)
                    .font(.system(size: 15, weight: .semibold, design: .rounded))
                    .foregroundStyle(Color.textSecondary)
                    .lineLimit(2)
                    .minimumScaleFactor(0.82)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct DailyReviewMetricGrid: View {
    let rows: [DailyReviewMetricRow]

    private let columns = [
        GridItem(.flexible(), spacing: 10),
        GridItem(.flexible(), spacing: 10)
    ]

    var body: some View {
        LazyVGrid(columns: columns, spacing: 10) {
            ForEach(rows) { row in
                DailyReviewMetricCard(row: row)
            }
        }
    }
}

private struct DailyReviewMetricCard: View {
    let row: DailyReviewMetricRow

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: row.systemImageName)
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(row.tone.color)
                .frame(width: 32, height: 32)
                .background(row.tone.color.opacity(0.13), in: Circle())

            VStack(alignment: .leading, spacing: 2) {
                Text(row.value)
                    .font(.system(size: 22, weight: .heavy, design: .rounded))
                    .foregroundStyle(Color.textPrimary)
                    .monospacedDigit()
                    .lineLimit(1)
                    .minimumScaleFactor(0.72)
                Text(row.label)
                    .font(.system(size: 12, weight: .bold, design: .rounded))
                    .foregroundStyle(Color.textSecondary)
                    .textCase(.uppercase)
                    .lineLimit(1)
                    .minimumScaleFactor(0.78)
            }

            Spacer(minLength: 0)
        }
        .padding(.horizontal, 12)
        .frame(minHeight: 74)
        .background(Color.surfacePrimary.opacity(0.9), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(Color.borderSubtle, lineWidth: 1))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(row.label): \(row.value)")
    }
}

private struct DailyReviewSection<Content: View>: View {
    let title: String
    let count: Int
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Text(title)
                    .font(.system(size: 13, weight: .bold, design: .rounded))
                    .foregroundStyle(Color.textSecondary)
                    .textCase(.uppercase)

                Text("\(count)")
                    .font(.system(size: 12, weight: .heavy, design: .rounded))
                    .foregroundStyle(Color.textPrimary)
                    .monospacedDigit()
                    .padding(.horizontal, 7)
                    .frame(height: 22)
                    .background(Color.surfaceRaised, in: Capsule())
            }

            VStack(spacing: 10) {
                content
            }
        }
    }
}

private struct DailyReviewNoteCard: View {
    let row: DailyReviewNoteRow

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: "note.text")
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(Color.accentNote)
                .frame(width: 32, height: 32)
                .background(Color.accentNote.opacity(0.13), in: Circle())

            VStack(alignment: .leading, spacing: 8) {
                Text(row.text)
                    .font(.system(size: 16, weight: .semibold, design: .rounded))
                    .foregroundStyle(Color.textPrimary)
                    .fixedSize(horizontal: false, vertical: true)

                DailyReviewStagePill(stage: row.stage)
            }

            Spacer(minLength: 0)
        }
        .padding(14)
        .background(Color.surfacePrimary.opacity(0.9), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(Color.borderSubtle, lineWidth: 1))
        .accessibilityElement(children: .combine)
    }
}

private struct DailyReviewActionCard: View {
    let row: DailyReviewActionRow

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: "checklist")
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(Color.accentSuccess)
                .frame(width: 32, height: 32)
                .background(Color.accentSuccess.opacity(0.13), in: Circle())

            VStack(alignment: .leading, spacing: 5) {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text(row.title)
                        .font(.system(size: 16, weight: .heavy, design: .rounded))
                        .foregroundStyle(Color.textPrimary)
                        .lineLimit(2)
                        .minimumScaleFactor(0.82)

                    Spacer(minLength: 6)

                    Text(row.status)
                        .font(.system(size: 11, weight: .bold, design: .rounded))
                        .foregroundStyle(Color.accentSuccess)
                        .lineLimit(1)
                        .minimumScaleFactor(0.76)
                }

                if !row.body.isEmpty {
                    Text(row.body)
                        .font(.system(size: 14, weight: .semibold, design: .rounded))
                        .foregroundStyle(Color.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
        .padding(14)
        .background(Color.surfacePrimary.opacity(0.9), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(Color.borderSubtle, lineWidth: 1))
        .accessibilityElement(children: .combine)
    }
}

private struct DailyReviewSignalCard: View {
    let row: DailyReviewSignalRow

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: "waveform.path.ecg")
                .font(.system(size: 14, weight: .bold))
                .foregroundStyle(Color.accentSignal)
                .frame(width: 32, height: 32)
                .background(Color.accentSignal.opacity(0.13), in: Circle())

            VStack(alignment: .leading, spacing: 5) {
                Text(row.title)
                    .font(.system(size: 16, weight: .heavy, design: .rounded))
                    .foregroundStyle(Color.textPrimary)
                    .fixedSize(horizontal: false, vertical: true)

                Text(row.detail)
                    .font(.system(size: 13, weight: .bold, design: .rounded))
                    .foregroundStyle(Color.textSecondary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.78)
            }

            Spacer(minLength: 0)
        }
        .padding(14)
        .background(Color.surfacePrimary.opacity(0.9), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(Color.borderSubtle, lineWidth: 1))
        .accessibilityElement(children: .combine)
    }
}

private struct DailyReviewStagePill: View {
    let stage: CaptureStage

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: stage.dailyReviewIcon)
                .font(.system(size: 10, weight: .bold))
            Text(stage.label ?? "Draft")
                .font(.system(size: 12, weight: .bold, design: .rounded))
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
        .foregroundStyle(stage.dailyReviewTint)
        .padding(.horizontal, 10)
        .frame(height: 28)
        .background(stage.dailyReviewTint.opacity(0.12), in: Capsule())
    }
}

private struct DailyReviewEmptyCard: View {
    let localDate: String

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "calendar.badge.plus")
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(Color.accentStreak)
                .frame(width: 34, height: 34)
                .background(Color.accentStreak.opacity(0.13), in: Circle())

            VStack(alignment: .leading, spacing: 3) {
                Text("No notes captured today")
                    .font(.system(size: 16, weight: .heavy, design: .rounded))
                    .foregroundStyle(Color.textPrimary)
                Text(localDate)
                    .font(.system(size: 13, weight: .bold, design: .rounded))
                    .foregroundStyle(Color.textSecondary)
                    .monospacedDigit()
            }

            Spacer(minLength: 0)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.surfacePrimary.opacity(0.9), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(Color.borderSubtle, lineWidth: 1))
    }
}

private extension DailyReviewMetricTone {
    var color: Color {
        switch self {
        case .action:
            Color.accentSuccess
        case .insight:
            Color.accentInsight
        case .note:
            Color.accentNote
        case .signal:
            Color.accentSignal
        }
    }
}

private extension CaptureStage {
    var dailyReviewIcon: String {
        switch self {
        case .analysisFailed:
            "exclamationmark.triangle.fill"
        case .analysisTimedOut:
            "clock.badge.exclamationmark"
        case .idle:
            "circle"
        case .saving:
            "square.and.arrow.down"
        case .refreshing:
            "arrow.triangle.2.circlepath"
        case .queued:
            "tray.and.arrow.up.fill"
        case .processing:
            "wand.and.stars"
        case .saved:
            "checkmark"
        }
    }

    var dailyReviewTint: Color {
        switch self {
        case .analysisFailed, .analysisTimedOut:
            Color.feedbackCritical
        case .idle, .refreshing, .saving:
            Color.textSecondary
        case .queued, .processing:
            Color.accentInsight
        case .saved:
            Color.accentSuccess
        }
    }
}

struct StreakCalendarSheet: View {
    let store: StoreOf<NudgeCaptureFeature>
    @Environment(\.dismiss) private var dismiss
    @State private var selectedDate: String

    init(store: StoreOf<NudgeCaptureFeature>) {
        self.store = store
        _selectedDate = State(initialValue: store.todayLocalDate)
    }

    var body: some View {
        let snapshot = CalendarStatsBuilder.makeDayStats(
            days: store.calendarDays,
            currentJournalDate: store.journal?.localDate,
            dailyStreak: store.dailyStreak,
            selectedDate: selectedDate
        )

        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: 18) {
                CalendarSheetHandle()

                CalendarDateHeader(
                    selectedDate: selectedDate,
                    hasActivity: snapshot.selectedDay.hasActivity,
                    previousDay: { selectedDate = CalendarFormatting.offset(selectedDate, by: -1) },
                    nextDay: { selectedDate = CalendarFormatting.offset(selectedDate, by: 1) },
                    dismiss: dismiss.callAsFunction
                )

                NudgeActivityCalendar(
                    snapshot: snapshot,
                    selectedDate: $selectedDate,
                    today: store.todayLocalDate
                )
                .frame(height: 390)

                SelectedDayStatsView(day: snapshot.selectedDay)
                StreakFooter(snapshot: snapshot)
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 32)
        }
        .task { await store.send(.refreshContext).finish() }
        .background(Color.appBackground.ignoresSafeArea())
        .preferredColorScheme(.dark)
    }
}

struct CalendarSheetHandle: View {
    var body: some View {
        Capsule()
            .fill(Color.textSecondary.opacity(0.32))
            .frame(width: 42, height: 5)
            .frame(maxWidth: .infinity)
            .padding(.top, 8)
    }
}

struct CalendarDateHeader: View {
    let selectedDate: String
    let hasActivity: Bool
    let previousDay: () -> Void
    let nextDay: () -> Void
    let dismiss: (() -> Void)?

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text(CalendarFormatting.title(for: selectedDate))
                    .font(.system(size: 28, weight: .heavy, design: .rounded))
                    .foregroundStyle(Color.textPrimary)
                Text(hasActivity ? "You showed up here." : "No activity on this day yet.")
                    .font(.system(size: 14, weight: .semibold, design: .rounded))
                    .foregroundStyle(Color.textSecondary)
            }

            Spacer()

            CalendarIconButton(systemName: "chevron.left", action: previousDay)
            CalendarIconButton(systemName: "chevron.right", action: nextDay)
            if let dismiss {
                CalendarIconButton(systemName: "xmark", size: 13, action: dismiss)
            }
        }
    }
}

struct CalendarIconButton: View {
    let systemName: String
    var size: CGFloat = 15
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(.system(size: size, weight: .bold))
                .foregroundStyle(Color.textPrimary)
                .frame(width: 34, height: 34)
                .background(Color.surfacePrimary, in: Circle())
        }
        .buttonStyle(.plain)
    }
}

struct StreakFooter: View {
    let snapshot: CalendarStatsSnapshot

    private var nextGoal: Int {
        max(7, ((snapshot.currentStreak / 7) + 1) * 7)
    }

    var body: some View {
        HStack(spacing: 0) {
            StreakFooterMetric(value: "\(snapshot.currentStreak)", label: "Current", color: .accentStreak, icon: "flame.fill")
            Divider()
                .overlay(Color.borderSubtle)
                .padding(.vertical, 8)
            StreakFooterMetric(value: "\(nextGoal)", label: "Next goal", color: .accentGoal, icon: "target")
            Divider()
                .overlay(Color.borderSubtle)
                .padding(.vertical, 8)
            StreakFooterMetric(value: "\(snapshot.bestStreak)", label: "Best", color: .accentSuccess, icon: "sparkles")
        }
        .frame(height: 78)
        .background(Color.surfacePrimary.opacity(0.94), in: RoundedRectangle(cornerRadius: 22, style: .continuous))
        .shadow(color: .shadowAmbient.opacity(0.45), radius: 16, y: 8)
    }
}

struct StreakFooterMetric: View {
    let value: String
    let label: String
    let color: Color
    let icon: String

    var body: some View {
        VStack(spacing: 5) {
            Image(systemName: icon)
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(color)
            Text(value)
                .font(.system(size: 25, weight: .heavy, design: .rounded))
                .foregroundStyle(Color.textPrimary)
                .monospacedDigit()
            Text(label)
                .font(.system(size: 12, weight: .semibold, design: .rounded))
                .foregroundStyle(Color.textSecondary)
                .lineLimit(1)
                .minimumScaleFactor(0.82)
        }
        .frame(maxWidth: .infinity)
    }
}

struct NudgeActivityCalendar: View {
    let snapshot: CalendarStatsSnapshot
    @Binding var selectedDate: String
    let today: String
    @StateObject private var proxy = CalendarViewProxy()
    @State private var didScrollToToday = false

    private var calendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.locale = .current
        calendar.timeZone = .current
        return calendar
    }

    var body: some View {
        CalendarViewRepresentable(
            calendar: calendar,
            visibleDateRange: CalendarFormatting.visibleRange(around: today),
            monthsLayout: .vertical(
                options: VerticalMonthsLayoutOptions(pinDaysOfWeekToTop: true)
            ),
            dataDependency: "\(selectedDate)-\(snapshot.totalSignals)-\(snapshot.totalNotes)",
            proxy: proxy
        )
        .backgroundColor(UIColor(red: 0.035, green: 0.039, blue: 0.043, alpha: 1))
        .interMonthSpacing(18)
        .verticalDayMargin(5)
        .horizontalDayMargin(5)
        .monthDayInsets(NSDirectionalEdgeInsets(top: 10, leading: 0, bottom: 10, trailing: 0))
        .monthHeaders { month in
            HStack {
                Text(CalendarFormatting.monthTitle(month, calendar: calendar))
                    .font(.system(size: 18, weight: .heavy, design: .rounded))
                    .foregroundStyle(Color.textPrimary)
                Spacer()
            }
            .padding(.vertical, 6)
            .accessibilityAddTraits(.isHeader)
        }
        .dayOfWeekHeaders { _, weekdayIndex in
            Text(CalendarFormatting.weekdayTitle(weekdayIndex, calendar: calendar))
                .font(.system(size: 11, weight: .bold, design: .rounded))
                .foregroundStyle(Color.textSecondary)
                .frame(maxWidth: .infinity)
        }
        .days { day in
            let localDate = String(describing: day)
            NudgeCalendarDayCell(
                day: day.day,
                stats: snapshot.dayStatsByDate[localDate],
                isSelected: localDate == selectedDate,
                isToday: localDate == today
            )
        }
        .onDaySelection { day in
            selectedDate = String(describing: day)
        }
        .onAppear {
            guard !didScrollToToday, let date = CalendarFormatting.date(from: today) else { return }
            didScrollToToday = true
            proxy.scrollToDay(containing: date, scrollPosition: .centered, animated: false)
        }
    }
}

struct NudgeCalendarDayCell: View {
    let day: Int
    let stats: CalendarDayStats?
    let isSelected: Bool
    let isToday: Bool

    var body: some View {
        VStack(spacing: 3) {
            if isStreakDay {
                Image(systemName: "flame.fill")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(Color.accentStreak)
                    .frame(height: 12)
            } else {
                Color.clear.frame(height: 12)
            }

            Text("\(day)")
                .font(.system(size: 18, weight: isSelected || isToday || isStreakDay ? .heavy : .semibold, design: .rounded))
                .foregroundStyle(dayColor)
                .monospacedDigit()
                .frame(width: 38, height: 38)
                .background(selectedFill, in: Circle())
                .overlay(Circle().stroke(isToday && !isSelected ? Color.textPrimary.opacity(0.8) : Color.clear, lineWidth: 1.5))
        }
        .frame(maxWidth: .infinity, minHeight: 58)
        .accessibilityLabel("\(day), \(stats?.noteCount ?? 0) notes, \(stats?.signalCount ?? 0) signals")
    }

    private var isStreakDay: Bool {
        stats?.hasActivity == true
    }

    private var selectedFill: Color {
        isSelected ? Color.textPrimary : Color.clear
    }

    private var dayColor: Color {
        if isSelected {
            return isStreakDay ? .accentStreak : .appBackground
        }
        if isStreakDay || isToday {
            return .accentStreak
        }
        return Color.textPrimary.opacity(0.58)
    }
}

struct WeekStatsView: View {
    let snapshot: CalendarStatsSnapshot
    let selectedDate: String

    var body: some View {
        VStack(spacing: 10) {
            ForEach(CalendarFormatting.weekDates(containing: selectedDate), id: \.self) { localDate in
                let stats = snapshot.dayStatsByDate[localDate] ?? CalendarDayStats(localDate: localDate, noteCount: 0, signalCount: 0)
                HStack(spacing: 12) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(CalendarFormatting.shortWeekday(for: localDate))
                            .font(.system(size: 13, weight: .bold, design: .rounded))
                            .foregroundStyle(localDate == selectedDate ? Color.textPrimary : Color.textSecondary)
                        Text(CalendarFormatting.shortDay(for: localDate))
                            .font(.system(size: 12, weight: .semibold, design: .rounded))
                            .foregroundStyle(Color.textSecondary)
                    }
                    .frame(width: 46, alignment: .leading)

                    CalendarActivityBar(count: stats.noteCount, color: .accentNote)
                    CalendarActivityBar(count: stats.signalCount, color: .accentSignal)

                    Text("\(stats.noteCount) notes / \(stats.signalCount) signals")
                        .font(.system(size: 13, weight: .bold, design: .rounded))
                        .foregroundStyle(Color.textPrimary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.76)
                }
                .padding(.horizontal, 14)
                .frame(height: 56)
                .background(Color.surfacePrimary.opacity(localDate == selectedDate ? 0.98 : 0.72), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            }
        }
    }
}

struct CalendarActivityBar: View {
    let count: Int
    let color: Color

    var body: some View {
        GeometryReader { geometry in
            Capsule()
                .fill(Color.surfaceRaised)
                .overlay(alignment: .leading) {
                    Capsule()
                        .fill(color)
                        .frame(width: count == 0 ? 0 : max(8, min(geometry.size.width, CGFloat(count) * 18)))
                }
        }
        .frame(height: 8)
    }
}

struct DailyCalendarTimelineView: View {
    let snapshot: CalendarStatsSnapshot
    @Binding var selectedDate: String
    let today: String

    private let startHour = 7
    private let endHour = 20
    private let hourHeight: CGFloat = 46

    private var day: CalendarDayStats {
        snapshot.selectedDay
    }

    private var hours: [Int] {
        Array(startHour...endHour)
    }

    private var timelineItems: [CalendarDayTimelineItem] {
        CalendarDayTimelineBuilder.items(for: day)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Timeline")
                        .font(.system(size: 19, weight: .heavy, design: .rounded))
                        .foregroundStyle(Color.textPrimary)
                    Text(day.localDate)
                        .font(.system(size: 13, weight: .bold, design: .rounded))
                        .foregroundStyle(Color.textSecondary)
                        .monospacedDigit()
                }

                Spacer(minLength: 8)

                HStack(spacing: 8) {
                    CalendarDayMiniMetric(value: day.noteCount, color: .accentNote, icon: "note.text")
                    CalendarDayMiniMetric(value: day.signalCount, color: .accentSignal, icon: "waveform.path.ecg")
                }
            }

            DailyCalendarDayTicker(snapshot: snapshot, selectedDate: $selectedDate, today: today)
            DailyCalendarAllDayLane(day: day)

            HStack(alignment: .top, spacing: 12) {
                VStack(spacing: 0) {
                    ForEach(hours, id: \.self) { hour in
                        Text(CalendarFormatting.hourLabel(hour))
                            .font(.system(size: 11, weight: .bold, design: .rounded))
                            .foregroundStyle(Color.textSecondary)
                            .monospacedDigit()
                            .lineLimit(1)
                            .minimumScaleFactor(0.78)
                            .frame(width: 46, height: hourHeight, alignment: .topTrailing)
                    }
                }

                ZStack(alignment: .topLeading) {
                    VStack(spacing: 0) {
                        ForEach(hours, id: \.self) { _ in
                            VStack(spacing: 0) {
                                Rectangle()
                                    .fill(Color.borderSubtle)
                                    .frame(height: 1)
                                Spacer(minLength: 0)
                            }
                            .frame(height: hourHeight)
                        }
                    }

                    ForEach(timelineItems) { item in
                        DayTimelineBlock(item: item)
                            .frame(height: height(for: item), alignment: .topLeading)
                            .offset(y: offset(for: item))
                    }

                    TimelineView(.periodic(from: Date(), by: 60)) { context in
                        if selectedDate == today, let currentOffset = currentTimeOffset(at: context.date) {
                            CurrentTimeMarker(label: CalendarFormatting.timeLabel(context.date))
                                .offset(y: currentOffset)
                        }
                    }
                }
                .frame(height: CGFloat(hours.count) * hourHeight, alignment: .top)
                .frame(maxWidth: .infinity)
                .background(Color.surfaceRaised.opacity(0.46), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
        }
        .padding(16)
        .background(Color.surfacePrimary.opacity(0.94), in: RoundedRectangle(cornerRadius: 28, style: .continuous))
        .shadow(color: .shadowAmbient.opacity(0.5), radius: 18, y: 9)
    }

    private func offset(for item: CalendarDayTimelineItem) -> CGFloat {
        CGFloat(item.startHour - Double(startHour)) * hourHeight
    }

    private func height(for item: CalendarDayTimelineItem) -> CGFloat {
        max(62, CGFloat(item.durationHours) * hourHeight)
    }

    private func currentTimeOffset(at date: Date) -> CGFloat? {
        let hour = CalendarFormatting.hourDecimal(from: date)
        guard hour >= Double(startHour), hour <= Double(endHour + 1) else { return nil }
        return CGFloat(hour - Double(startHour)) * hourHeight
    }
}

struct DailyCalendarDayTicker: View {
    let snapshot: CalendarStatsSnapshot
    @Binding var selectedDate: String
    let today: String

    private var weekDates: [String] {
        CalendarFormatting.weekDates(containing: selectedDate)
    }

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(weekDates, id: \.self) { localDate in
                    let stats = snapshot.dayStatsByDate[localDate] ?? CalendarDayStats(localDate: localDate, noteCount: 0, signalCount: 0)
                    DayTickerButton(
                        localDate: localDate,
                        stats: stats,
                        isSelected: localDate == selectedDate,
                        isToday: localDate == today,
                        select: { selectedDate = localDate }
                    )
                }
            }
            .padding(.vertical, 1)
        }
    }
}

struct DayTickerButton: View {
    let localDate: String
    let stats: CalendarDayStats
    let isSelected: Bool
    let isToday: Bool
    let select: () -> Void

    var body: some View {
        Button(action: select) {
            VStack(spacing: 6) {
                Text(CalendarFormatting.shortWeekday(for: localDate).uppercased())
                    .font(.system(size: 10, weight: .heavy, design: .rounded))
                    .foregroundStyle(isSelected ? Color.textPrimary : Color.textSecondary)

                Text(CalendarFormatting.dayNumber(for: localDate))
                    .font(.system(size: 19, weight: .heavy, design: .rounded))
                    .foregroundStyle(Color.textPrimary)
                    .monospacedDigit()

                HStack(spacing: 4) {
                    Circle()
                        .fill(stats.noteCount > 0 ? Color.accentNote : Color.textSecondary.opacity(0.22))
                        .frame(width: 5, height: 5)
                    Circle()
                        .fill(stats.signalCount > 0 ? Color.accentSignal : Color.textSecondary.opacity(0.22))
                        .frame(width: 5, height: 5)
                }
            }
            .frame(width: 48, height: 64)
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(isSelected ? Color.accentInsight.opacity(0.26) : Color.surfaceRaised.opacity(0.52))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(isToday ? Color.accentStreak.opacity(0.76) : Color.clear, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(localDate), \(stats.noteCount) notes, \(stats.signalCount) signals")
    }
}

struct DailyCalendarAllDayLane: View {
    let day: CalendarDayStats

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            Text("all-day")
                .font(.system(size: 11, weight: .bold, design: .rounded))
                .foregroundStyle(Color.textSecondary)
                .frame(width: 46, alignment: .trailing)

            HStack(spacing: 8) {
                if day.hasActivity {
                    DailyCalendarContextChip(text: "\(day.noteCount) notes", color: .accentNote, icon: "note.text")
                    DailyCalendarContextChip(text: "\(day.signalCount) signals", color: .accentSignal, icon: "waveform.path.ecg")
                    DailyCalendarContextChip(text: "logged", color: .accentSuccess, icon: "checkmark")
                } else {
                    DailyCalendarContextChip(text: "open space", color: .accentStreak, icon: "calendar.badge.plus")
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

struct DailyCalendarContextChip: View {
    let text: String
    let color: Color
    let icon: String

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: icon)
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(color)
            Text(text)
                .font(.system(size: 12, weight: .bold, design: .rounded))
                .foregroundStyle(Color.textPrimary)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
        .padding(.horizontal, 10)
        .frame(minHeight: 32)
        .background(color.opacity(0.11), in: Capsule())
    }
}

struct CurrentTimeMarker: View {
    let label: String

    var body: some View {
        HStack(spacing: 6) {
            Text(label)
                .font(.system(size: 10, weight: .heavy, design: .rounded))
                .foregroundStyle(Color.appBackground)
                .monospacedDigit()
                .padding(.horizontal, 6)
                .frame(height: 18)
                .background(Color.accentStreak, in: Capsule())

            Rectangle()
                .fill(Color.accentStreak)
                .frame(height: 1)
        }
        .frame(maxWidth: .infinity)
        .shadow(color: Color.accentStreak.opacity(0.32), radius: 6, y: 2)
    }
}

struct CalendarDayMiniMetric: View {
    let value: Int
    let color: Color
    let icon: String

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: icon)
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(color)
            Text("\(value)")
                .font(.system(size: 13, weight: .heavy, design: .rounded))
                .foregroundStyle(Color.textPrimary)
                .monospacedDigit()
        }
        .frame(minWidth: 50, minHeight: 34)
        .background(color.opacity(0.12), in: Capsule())
    }
}

struct DayTimelineBlock: View {
    let item: CalendarDayTimelineItem

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: icon)
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(accent)
                .frame(width: 28, height: 28)
                .background(accent.opacity(0.13), in: Circle())

            VStack(alignment: .leading, spacing: 4) {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text(item.title)
                        .font(.system(size: 15, weight: .heavy, design: .rounded))
                        .foregroundStyle(Color.textPrimary)
                        .lineLimit(1)
                    Spacer(minLength: 6)
                    if item.count > 0 {
                        Text("\(item.count)")
                            .font(.system(size: 12, weight: .heavy, design: .rounded))
                            .foregroundStyle(accent)
                            .monospacedDigit()
                    }
                }

                Text(item.subtitle)
                    .font(.system(size: 12, weight: .semibold, design: .rounded))
                    .foregroundStyle(Color.textSecondary)
                    .lineLimit(2)
                    .minimumScaleFactor(0.86)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(
            LinearGradient(
                colors: [accent.opacity(0.24), accent.opacity(0.11)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            ),
            in: RoundedRectangle(cornerRadius: 14, style: .continuous)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(accent.opacity(0.24), lineWidth: 1)
        )
        .padding(.trailing, 10)
        .padding(.vertical, 3)
    }

    private var accent: Color {
        switch item.kind {
        case .notes:
            .accentNote
        case .signals:
            .accentSignal
        case .momentum:
            .accentSuccess
        case .openSpace:
            .accentStreak
        }
    }

    private var icon: String {
        switch item.kind {
        case .notes:
            "note.text"
        case .signals:
            "waveform.path.ecg"
        case .momentum:
            "sparkles"
        case .openSpace:
            "calendar.badge.plus"
        }
    }
}

struct SelectedDayStatsView: View {
    let day: CalendarDayStats

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Selected day")
                    .font(.system(size: 17, weight: .bold, design: .rounded))
                    .foregroundStyle(Color.textSecondary)
                Spacer()
                Text(day.localDate)
                    .font(.system(size: 13, weight: .bold, design: .rounded))
                    .foregroundStyle(Color.accentInsight)
            }

            HStack(spacing: 10) {
                CalendarDayMetric(value: "\(day.noteCount)", label: "Notes", color: .accentNote)
                CalendarDayMetric(value: "\(day.signalCount)", label: "Signals", color: .accentSignal)
                CalendarDayMetric(value: day.hasActivity ? "Yes" : "Open", label: "Logged", color: .accentSuccess)
            }
        }
        .padding(16)
        .background(Color.surfacePrimary.opacity(0.94), in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .shadow(color: .shadowAmbient.opacity(0.45), radius: 16, y: 8)
    }
}

struct CalendarDayMetric: View {
    let value: String
    let label: String
    let color: Color

    var body: some View {
        VStack(spacing: 5) {
            Text(value)
                .font(.system(size: 20, weight: .heavy, design: .rounded))
                .foregroundStyle(Color.textPrimary)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            Text(label)
                .font(.system(size: 12, weight: .semibold, design: .rounded))
                .foregroundStyle(Color.textSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 10)
        .background(color.opacity(0.11), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}

private enum CalendarFormatting {
    static func date(from localDate: String) -> Date? {
        let parts = localDate.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return nil }
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = .current
        return calendar.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2]))
    }

    static func localDate(from date: Date) -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }

    static func offset(_ localDate: String, by days: Int) -> String {
        guard let date = date(from: localDate) else { return localDate }
        let nextDate = Calendar(identifier: .gregorian).date(byAdding: .day, value: days, to: date) ?? date
        return self.localDate(from: nextDate)
    }

    static func visibleRange(around localDate: String) -> ClosedRange<Date> {
        let center = date(from: localDate) ?? Date()
        let calendar = Calendar(identifier: .gregorian)
        let start = calendar.date(byAdding: .month, value: -3, to: center) ?? center
        let end = calendar.date(byAdding: .month, value: 1, to: center) ?? center
        return start...end
    }

    static func weekDates(containing localDate: String) -> [String] {
        guard let date = date(from: localDate) else { return [] }
        var calendar = Calendar(identifier: .gregorian)
        calendar.firstWeekday = 2
        let start = calendar.dateInterval(of: .weekOfYear, for: date)?.start ?? date
        return (0..<7).map {
            self.localDate(from: calendar.date(byAdding: .day, value: $0, to: start) ?? start)
        }
    }

    static func title(for localDate: String) -> String {
        guard let date = date(from: localDate) else { return localDate }
        let formatter = DateFormatter()
        formatter.dateFormat = "EEEE, MMM d"
        return formatter.string(from: date)
    }

    static func monthTitle(_ month: MonthComponents, calendar: Calendar) -> String {
        guard let date = calendar.date(from: month.components) else { return "\(month)" }
        let formatter = DateFormatter()
        formatter.dateFormat = "MMMM yyyy"
        return formatter.string(from: date)
    }

    static func weekdayTitle(_ weekdayIndex: Int, calendar: Calendar) -> String {
        let symbols = calendar.shortStandaloneWeekdaySymbols
        return String(symbols[weekdayIndex % symbols.count].prefix(2)).uppercased()
    }

    static func shortWeekday(for localDate: String) -> String {
        guard let date = date(from: localDate) else { return "" }
        let formatter = DateFormatter()
        formatter.dateFormat = "EEE"
        return formatter.string(from: date)
    }

    static func shortDay(for localDate: String) -> String {
        guard let date = date(from: localDate) else { return localDate }
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM d"
        return formatter.string(from: date)
    }

    static func dayNumber(for localDate: String) -> String {
        guard let date = date(from: localDate) else { return "" }
        let formatter = DateFormatter()
        formatter.dateFormat = "d"
        return formatter.string(from: date)
    }

    static func hourLabel(_ hour: Int) -> String {
        let normalizedHour = ((hour % 24) + 24) % 24
        let localeHourFormat = DateFormatter.dateFormat(fromTemplate: "j", options: 0, locale: .current) ?? "h a"
        if !localeHourFormat.contains("a") {
            return String(format: "%02d:00", normalizedHour)
        }

        let displayHour = normalizedHour == 0 ? 12 : (normalizedHour > 12 ? normalizedHour - 12 : normalizedHour)
        return "\(displayHour) \(normalizedHour < 12 ? "AM" : "PM")"
    }

    static func hourDecimal(from date: Date) -> Double {
        let components = Calendar.current.dateComponents([.hour, .minute], from: date)
        return Double(components.hour ?? 0) + Double(components.minute ?? 0) / 60
    }

    static func timeLabel(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}
