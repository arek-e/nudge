import AppIntents
import SwiftUI

@main
struct LaresApp: App {
    init() {
        LaresNotifications.requestAuthorization()
        LaresShortcuts.updateAppShortcutParameters()
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
