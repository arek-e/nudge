import Foundation

struct CalendarDayStats: Decodable, Hashable, Identifiable {
    var id: String { localDate }
    let localDate: String
    let noteCount: Int
    let signalCount: Int

    var hasActivity: Bool {
        noteCount > 0 || signalCount > 0
    }
}

enum CalendarDayTimelineKind: String, Hashable {
    case notes
    case signals
    case momentum
    case openSpace
}

struct CalendarDayTimelineItem: Hashable, Identifiable {
    let id: String
    let kind: CalendarDayTimelineKind
    let title: String
    let subtitle: String
    let startHour: Double
    let durationHours: Double
    let count: Int
}

struct CalendarStatsSnapshot {
    let days: [CalendarDayStats]
    let selectedDay: CalendarDayStats
    let totalNotes: Int
    let totalSignals: Int
    let activeDays: Int
    let bestStreak: Int
    let currentStreak: Int

    var dayStatsByDate: [String: CalendarDayStats] {
        Dictionary(uniqueKeysWithValues: days.map { ($0.localDate, $0) })
    }
}

enum CalendarDayTimelineBuilder {
    static func items(for day: CalendarDayStats) -> [CalendarDayTimelineItem] {
        var items: [CalendarDayTimelineItem] = []

        if day.noteCount > 0 {
            items.append(
                CalendarDayTimelineItem(
                    id: "\(day.localDate)-notes",
                    kind: .notes,
                    title: "Notes",
                    subtitle: "\(day.noteCount) \(plural("note", count: day.noteCount)) captured",
                    startHour: 8,
                    durationHours: duration(for: day.noteCount, base: 0.9, step: 0.28, maximum: 2.2),
                    count: day.noteCount
                )
            )
        }

        if day.signalCount > 0 {
            items.append(
                CalendarDayTimelineItem(
                    id: "\(day.localDate)-signals",
                    kind: .signals,
                    title: "Signals",
                    subtitle: "\(day.signalCount) \(plural("signal", count: day.signalCount)) found",
                    startHour: 11,
                    durationHours: duration(for: day.signalCount, base: 0.9, step: 0.22, maximum: 2.6),
                    count: day.signalCount
                )
            )
        }

        if day.noteCount > 0 && day.signalCount > 0 {
            let total = day.noteCount + day.signalCount
            items.append(
                CalendarDayTimelineItem(
                    id: "\(day.localDate)-momentum",
                    kind: .momentum,
                    title: "Momentum",
                    subtitle: "\(total) inputs connected",
                    startHour: 15,
                    durationHours: duration(for: total, base: 0.8, step: 0.16, maximum: 1.6),
                    count: total
                )
            )
        }

        if items.isEmpty {
            items.append(
                CalendarDayTimelineItem(
                    id: "\(day.localDate)-open-space",
                    kind: .openSpace,
                    title: "Open space",
                    subtitle: "No notes or signals yet",
                    startHour: 9,
                    durationHours: 1.2,
                    count: 0
                )
            )
        }

        return items
    }

    private static func duration(for count: Int, base: Double, step: Double, maximum: Double) -> Double {
        min(maximum, base + Double(max(0, count - 1)) * step)
    }

    private static func plural(_ word: String, count: Int) -> String {
        count == 1 ? word : "\(word)s"
    }
}

enum CalendarStatsBuilder {
    static func makeDayStats(
        days: [CalendarDayStats],
        currentJournalDate: String?,
        dailyStreak: Int,
        selectedDate: String,
        calendar: Calendar = .current
    ) -> CalendarStatsSnapshot {
        var grouped = Dictionary(uniqueKeysWithValues: days.map {
            ($0.localDate, (notes: $0.noteCount, signals: $0.signalCount))
        })

        if let currentJournalDate {
            var value = grouped[currentJournalDate, default: (notes: 0, signals: 0)]
            value.notes = max(value.notes, 1)
            grouped[currentJournalDate] = value
        }

        let sortedDays = grouped
            .map { CalendarDayStats(localDate: $0.key, noteCount: $0.value.notes, signalCount: $0.value.signals) }
            .sorted { $0.localDate < $1.localDate }
        let selectedDay = grouped[selectedDate].map {
            CalendarDayStats(localDate: selectedDate, noteCount: $0.notes, signalCount: $0.signals)
        } ?? CalendarDayStats(localDate: selectedDate, noteCount: 0, signalCount: 0)

        return CalendarStatsSnapshot(
            days: sortedDays,
            selectedDay: selectedDay,
            totalNotes: sortedDays.reduce(0) { $0 + $1.noteCount },
            totalSignals: sortedDays.reduce(0) { $0 + $1.signalCount },
            activeDays: sortedDays.filter(\.hasActivity).count,
            bestStreak: bestStreak(in: sortedDays, calendar: calendar),
            currentStreak: dailyStreak
        )
    }

    private static func bestStreak(in days: [CalendarDayStats], calendar: Calendar) -> Int {
        let activeDates = days
            .filter(\.hasActivity)
            .compactMap { date(from: $0.localDate, calendar: calendar) }
            .sorted()
        guard !activeDates.isEmpty else { return 0 }

        var best = 1
        var current = 1
        for index in activeDates.indices.dropFirst() {
            let previous = activeDates[activeDates.index(before: index)]
            if calendar.dateComponents([.day], from: previous, to: activeDates[index]).day == 1 {
                current += 1
            } else {
                current = 1
            }
            best = max(best, current)
        }
        return best
    }

    private static func date(from localDate: String, calendar: Calendar) -> Date? {
        var calendar = calendar
        calendar.timeZone = .current
        let parts = localDate.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return nil }
        return calendar.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2]))
    }
}
