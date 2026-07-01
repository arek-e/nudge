import AppIntents
import UserNotifications

struct LogVoiceIntent: AppIntent {
    static var title: LocalizedStringResource = "Log Note"
    static var description = IntentDescription("Log spoken text.")
    static var openAppWhenRun = false

    @Parameter(
        title: "What should I log?",
        inputOptions: String.IntentInputOptions(multiline: true),
        requestValueDialog: IntentDialog("What should I log?")
    )
    var spokenText: String?

    func perform() async throws -> some IntentResult & ProvidesDialog {
        let text = try await $spokenText.requestValue(IntentDialog("What should I log?"))
            .trimmingCharacters(in: .whitespacesAndNewlines)

        guard !text.isEmpty else {
            return .result(dialog: IntentDialog("Nothing to log."))
        }

        do {
            let response = try await LaresAPI.logVoice(spokenText: text)
            if response.route == "reasoning_candidate" {
                await LaresNotifications.sendVoiceLogProcessed()
            }
            return .result(dialog: IntentDialog(stringLiteral: response.spokenResponse))
        } catch {
            return .result(
                dialog: IntentDialog(
                    stringLiteral: "I heard it, but couldn't reach the Lares Engine at \(LaresAPI.configuredEngineURL)."
                )
            )
        }
    }
}

enum LaresNotifications {
    static func requestAuthorization() {
        Task {
            _ = try? await UNUserNotificationCenter.current()
                .requestAuthorization(options: [.alert, .sound])
        }
    }

    static func sendVoiceLogProcessed() async {
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        guard settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional else {
            return
        }

        let content = UNMutableNotificationContent()
        content.title = "Lares"
        content.body = "Your Siri log is ready in Lares."
        content.sound = .default

        let request = UNNotificationRequest(
            identifier: "lares.voice.\(UUID().uuidString)",
            content: content,
            trigger: UNTimeIntervalNotificationTrigger(timeInterval: 2, repeats: false)
        )
        try? await UNUserNotificationCenter.current().add(request)
    }
}

struct LaresShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: LogVoiceIntent(),
            phrases: [
                "Tell \(.applicationName)",
                "Ask \(.applicationName)",
                "Capture in \(.applicationName)",
                "Add to \(.applicationName)",
                "Remember in \(.applicationName)",
                "Note to \(.applicationName)",
                "Log in \(.applicationName)",
                "Log something in \(.applicationName)",
                "Log this in \(.applicationName)",
            ],
            shortTitle: "Log Note",
            systemImageName: "waveform"
        )
    }
}
