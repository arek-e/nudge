import AppIntents
import ClerkKit
import SwiftUI

@main
struct NudgeApp: App {
    init() {
        if let publishableKey = NudgeClerkConfig.publishableKey {
            Clerk.configure(publishableKey: publishableKey)
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
