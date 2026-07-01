import AppIntents
import SwiftUI

@main
struct VestaApp: App {
    init() {
        VestaNotifications.requestAuthorization()
        VestaShortcuts.updateAppShortcutParameters()
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
