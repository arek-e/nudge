import Foundation

@main
enum CalendarStatsSelftest {
    static func main() {
        let calendar = Calendar(identifier: .gregorian)
        let days = [
            CalendarDayStats(localDate: "2026-06-29", noteCount: 1, signalCount: 2),
            CalendarDayStats(localDate: "2026-06-30", noteCount: 1, signalCount: 0)
        ]

        let stats = CalendarStatsBuilder.makeDayStats(
            days: days,
            currentJournalDate: "2026-07-01",
            dailyStreak: 5,
            selectedDate: "2026-06-29",
            calendar: calendar
        )

        assert(stats.selectedDay.localDate == "2026-06-29")
        assert(stats.selectedDay.noteCount == 1)
        assert(stats.selectedDay.signalCount == 2)
        assert(stats.totalNotes == 3)
        assert(stats.activeDays == 3)
        assert(stats.bestStreak == 3)
        assert(stats.currentStreak == 5)

        let timeline = CalendarDayTimelineBuilder.items(for: stats.selectedDay)
        assert(timeline.map(\.title) == ["Notes", "Signals", "Momentum"])
        assert(timeline.map(\.kind) == [.notes, .signals, .momentum])
        assert(timeline[0].startHour == 8)
        assert(timeline[1].startHour == 11)
        assert(timeline[2].startHour == 15)

        let openTimeline = CalendarDayTimelineBuilder.items(
            for: CalendarDayStats(localDate: "2026-07-02", noteCount: 0, signalCount: 0)
        )
        assert(openTimeline.count == 1)
        assert(openTimeline[0].kind == .openSpace)

        assert(NudgeChromeAction.todayCalendar.destination == .todayCalendar)
        assert(NudgeChromeAction.todayCalendar.sheet == nil)
        assert(NudgeChromeAction.settings.destination == .settings)
        assert(NudgeChromeAction.settings.sheet == nil)
    }
}
