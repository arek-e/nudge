import SwiftUI

private enum LaresColorPrimitive {
    static let base = Color(red: 0.035, green: 0.039, blue: 0.043)
    static let baseOverlay = Color(red: 0.075, green: 0.084, blue: 0.094)
    static let raisedOverlay = Color(red: 0.12, green: 0.13, blue: 0.145)
    static let content = Color(red: 0.93, green: 0.92, blue: 0.88)
    static let contentSubtle = Color(red: 0.48, green: 0.5, blue: 0.53)
    static let markA = Color(red: 0.94, green: 0.57, blue: 0.19)
    static let markB = Color(red: 0.34, green: 0.62, blue: 0.96)
    static let markC = Color(red: 0.25, green: 0.78, blue: 0.58)
    static let markD = Color(red: 0.84, green: 0.37, blue: 0.52)
    static let markE = Color(red: 0.55, green: 0.46, blue: 0.92)
}

extension Color {
    static let appBackground = LaresColorPrimitive.base
    static let surfacePrimary = LaresColorPrimitive.baseOverlay
    static let surfaceRaised = LaresColorPrimitive.raisedOverlay
    static let textPrimary = LaresColorPrimitive.content
    static let textSecondary = LaresColorPrimitive.contentSubtle
    static let accentPrimary = LaresColorPrimitive.markB
    static let accentCapture = LaresColorPrimitive.markB
    static let accentStreak = LaresColorPrimitive.markA
    static let accentGoal = LaresColorPrimitive.markB
    static let accentNote = LaresColorPrimitive.markB
    static let accentSignal = LaresColorPrimitive.markD
    static let accentSuccess = LaresColorPrimitive.markC
    static let accentInsight = LaresColorPrimitive.markE
    static let accentReference = LaresColorPrimitive.markB
    static let feedbackCritical = LaresColorPrimitive.markD
    static let shimmerSubtle = Color.white.opacity(0.16)
    static let shimmerStrong = Color.white.opacity(0.32)
    static let shadowAmbient = Color.black.opacity(0.24)
    static let borderSubtle = Color.white.opacity(0.07)
}

extension String {
    var displayLabel: String {
        replacingOccurrences(of: "_", with: " ")
            .split(separator: " ")
            .map { $0.prefix(1).uppercased() + $0.dropFirst() }
            .joined(separator: " ")
    }
}
