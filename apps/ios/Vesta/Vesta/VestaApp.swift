import AppIntents
import ClerkKit
import SwiftUI

@main
struct VestaApp: App {
    init() {
        if let publishableKey = VestaClerkConfig.publishableKey {
            Clerk.configure(publishableKey: publishableKey)
        }
        VestaNotifications.requestAuthorization()
        VestaShortcuts.updateAppShortcutParameters()
    }

    var body: some Scene {
        WindowGroup {
            if VestaClerkConfig.publishableKey != nil {
                VestaAuthenticatedRoot()
            } else {
                VestaMissingClerkConfigurationView()
            }
        }
    }
}
