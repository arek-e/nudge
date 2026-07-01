import SwiftUI

private enum VestaColorPrimitive {
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
    static let appBackground = VestaColorPrimitive.base
    static let surfacePrimary = VestaColorPrimitive.baseOverlay
    static let surfaceRaised = VestaColorPrimitive.raisedOverlay
    static let textPrimary = VestaColorPrimitive.content
    static let textSecondary = VestaColorPrimitive.contentSubtle
    static let accentPrimary = VestaColorPrimitive.markB
    static let accentCapture = VestaColorPrimitive.markB
    static let accentStreak = VestaColorPrimitive.markA
    static let accentGoal = VestaColorPrimitive.markB
    static let accentNote = VestaColorPrimitive.markB
    static let accentSignal = VestaColorPrimitive.markD
    static let accentSuccess = VestaColorPrimitive.markC
    static let accentInsight = VestaColorPrimitive.markE
    static let accentReference = VestaColorPrimitive.markB
    static let feedbackCritical = VestaColorPrimitive.markD
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
