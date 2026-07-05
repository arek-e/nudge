import Foundation
import Sentry

enum NudgeSentry {
    private static let defaultTracesSampleRate = 0.05

    static func configure(bundle: Bundle = .main) {
        guard let dsn = bundle.nonEmptyInfoString("SentryDSN") else { return }

        SentrySDK.start { options in
            options.dsn = dsn
            options.environment = bundle.nonEmptyInfoString("NudgeEnvironmentName") ?? "production"
            options.releaseName = releaseName(bundle: bundle)
            options.sendDefaultPii = false
            options.tracesSampleRate = NSNumber(value: tracesSampleRate(bundle: bundle))
        }

        SentrySDK.configureScope { scope in
            scope.setTag(value: "nudge", key: "app")
            scope.setTag(value: "ios", key: "surface")
            scope.setTag(value: "ios", key: "app_surface")
            scope.setTag(value: "ios-native", key: "runtime_surface")
            scope.setContext(value: ["appSurface": "ios", "runtimeSurface": "ios-native"], key: "nudge")
        }
    }

    private static func releaseName(bundle: Bundle) -> String? {
        guard let version = bundle.nonEmptyInfoString("CFBundleShortVersionString") else { return nil }
        let build = bundle.nonEmptyInfoString("CFBundleVersion")
        if let build {
            return "nudge-ios@\(version)+\(build)"
        }
        return "nudge-ios@\(version)"
    }

    private static func tracesSampleRate(bundle: Bundle) -> Double {
        guard let rawValue = bundle.nonEmptyInfoString("SentryTracesSampleRate") else {
            return defaultTracesSampleRate
        }
        guard let parsed = Double(rawValue), parsed.isFinite else {
            return defaultTracesSampleRate
        }
        return min(1, max(0, parsed))
    }
}

private extension Bundle {
    func nonEmptyInfoString(_ key: String) -> String? {
        guard let value = object(forInfoDictionaryKey: key) as? String else { return nil }
        let normalized = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return normalized.isEmpty ? nil : normalized
    }
}
