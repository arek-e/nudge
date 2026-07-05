import AppIntents
import ClerkKit
import SwiftUI

@main
struct NudgeApp: App {
    init() {
        NudgeSentry.configure()
        if let publishableKey = NudgeClerkConfig.publishableKey {
            Clerk.configure(
                publishableKey: publishableKey,
                options: Clerk.Options(proxyUrl: NudgeClerkConfig.proxyURL)
            )
        }
        NudgeNotifications.requestAuthorization()
        NudgeShortcuts.updateAppShortcutParameters()
    }

    var body: some Scene {
        WindowGroup {
            if NudgeClerkConfig.publishableKey != nil {
                NudgeAuthenticatedRoot()
            } else {
                NudgeMissingClerkConfigurationView()
            }
        }
    }
}
