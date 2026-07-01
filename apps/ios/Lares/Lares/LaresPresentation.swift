import Foundation

enum LaresDestination: Hashable {
    case todayCalendar
}

enum LaresSheet: String, Identifiable {
    case streakCalendar

    var id: String { rawValue }
}

enum LaresChromeAction {
    case todayCalendar
    case streakCalendar

    var destination: LaresDestination? {
        switch self {
        case .todayCalendar:
            .todayCalendar
        case .streakCalendar:
            nil
        }
    }

    var sheet: LaresSheet? {
        switch self {
        case .todayCalendar:
            nil
        case .streakCalendar:
            .streakCalendar
        }
    }
}
