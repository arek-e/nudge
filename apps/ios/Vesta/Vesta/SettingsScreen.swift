import ClerkKit
import SwiftUI

struct SettingsScreen: View {
    @ObservedObject var model: VestaCaptureViewModel
    @Environment(Clerk.self) private var clerk
    @State private var signingOut = false
    @State private var signOutError: String?

    var body: some View {
        let account = accountSnapshot

        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: 18) {
                SettingsHero(account: account, streakText: streakText)

                SettingsSection(title: "Account") {
                    SettingsRow(
                        icon: "person.crop.circle.fill",
                        title: "Name",
                        value: account.displayName,
                        tint: .accentPrimary
                    )
                    SettingsDivider()
                    SettingsRow(
                        icon: "envelope.fill",
                        title: "Email",
                        value: account.emailAddress,
                        tint: .accentGoal
                    )
                    SettingsDivider()
                    SettingsRow(
                        icon: "checkmark.seal.fill",
                        title: "Email status",
                        value: account.emailVerification,
                        tint: account.emailVerification == "Verified" ? .accentSuccess : .feedbackCritical
                    )
                    SettingsDivider()
                    SettingsRow(
                        icon: "number",
                        title: "User ID",
                        value: account.userId,
                        tint: .accentInsight
                    )
                    SettingsDivider()
                    SettingsRow(
                        icon: "calendar.badge.plus",
                        title: "Created",
                        value: SettingsDateFormatting.dateTime(clerk.user?.createdAt),
                        tint: .accentSuccess
                    )
                    SettingsDivider()
                    SettingsRow(
                        icon: "clock.arrow.circlepath",
                        title: "Last sign-in",
                        value: SettingsDateFormatting.dateTime(clerk.user?.lastSignInAt),
                        tint: .accentGoal
                    )
                    SettingsDivider()
                    SettingsRow(
                        icon: "key.fill",
                        title: "Session ID",
                        value: account.sessionId,
                        tint: .accentReference
                    )
                }

                SettingsSection(title: "Streak") {
                    SettingsRow(
                        icon: "flame.fill",
                        title: "Current streak",
                        value: streakText,
                        tint: .accentStreak
                    )
                    SettingsDivider()
                    SettingsRow(
                        icon: "calendar",
                        title: "Today",
                        value: SettingsDateFormatting.title(for: model.todayLocalDate),
                        tint: .accentGoal
                    )
                }

                SettingsSection(title: "Sync") {
                    SettingsRow(
                        icon: "server.rack",
                        title: "Environment",
                        value: VestaEnvironmentConfig.current.displayName,
                        tint: .accentInsight
                    )
                    SettingsDivider()
                    SettingsRow(
                        icon: "network",
                        title: "Engine",
                        value: VestaAPI.configuredEngineURL,
                        tint: .accentReference
                    )
                    SettingsDivider()
                    SettingsRow(
                        icon: model.isOnline ? "wifi" : "wifi.slash",
                        title: "Connection",
                        value: model.isOnline ? "Online" : "Offline",
                        tint: model.isOnline ? .accentSuccess : .accentPrimary
                    )
                    SettingsDivider()
                    SettingsRow(
                        icon: "arrow.triangle.2.circlepath",
                        title: "Note sync",
                        value: model.statusMessage.isEmpty ? "Ready" : model.statusMessage,
                        tint: .accentPrimary
                    )
                    SettingsDivider()
                    SettingsRow(
                        icon: "clock.fill",
                        title: "Last active",
                        value: SettingsDateFormatting.dateTime(clerk.session?.lastActiveAt),
                        tint: .accentSuccess
                    )
                }

                SettingsSection(title: "Access") {
                    SettingsLogoutButton(isLoading: signingOut, action: signOut)
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 18)
            .padding(.bottom, 34)
        }
        .background(Color.appBackground.ignoresSafeArea())
        .navigationTitle("Settings")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(Color.appBackground, for: .navigationBar)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .preferredColorScheme(.dark)
        .alert("Could not log out", isPresented: signOutErrorPresented) {
            Button("OK", role: .cancel) {
                signOutError = nil
            }
        } message: {
            Text(signOutError ?? "Try again.")
        }
    }

    private var streakText: String {
        model.dailyStreak == 1 ? "1 day" : "\(model.dailyStreak) days"
    }

    private var accountSnapshot: AccountSettingsSnapshot {
        let user = clerk.user
        return AccountSettingsPolicy.evaluate(
            firstName: user?.firstName,
            lastName: user?.lastName,
            username: user?.username,
            emailAddress: user?.primaryEmailAddress?.emailAddress,
            userId: user?.id,
            sessionId: clerk.session?.id,
            hasVerifiedEmailAddress: user?.hasVerifiedEmailAddress ?? false
        )
    }

    private var signOutErrorPresented: Binding<Bool> {
        Binding(
            get: { signOutError != nil },
            set: { isPresented in
                if !isPresented {
                    signOutError = nil
                }
            }
        )
    }

    private func signOut() {
        guard !signingOut else { return }
        signingOut = true
        signOutError = nil

        Task {
            do {
                if let sessionId = clerk.session?.id {
                    try await clerk.auth.signOut(sessionId: sessionId)
                } else {
                    try await clerk.auth.signOut()
                }
            } catch {
                signOutError = error.localizedDescription
            }
            signingOut = false
        }
    }
}

private struct SettingsHero: View {
    let account: AccountSettingsSnapshot
    let streakText: String

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Image(systemName: "person.crop.circle.fill")
                .font(.system(size: 20, weight: .bold))
                .foregroundStyle(Color.accentPrimary)
                .frame(width: 42, height: 42)
                .background(Color.surfaceRaised, in: Circle())

            Text(account.displayName)
                .font(.system(size: 32, weight: .heavy, design: .rounded))
                .foregroundStyle(Color.textPrimary)
                .lineLimit(2)
                .minimumScaleFactor(0.78)

            Text("\(account.emailAddress) · \(streakText)")
                .font(.system(size: 15, weight: .semibold, design: .rounded))
                .foregroundStyle(Color.textSecondary)
                .lineLimit(2)
                .minimumScaleFactor(0.82)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(18)
        .background(Color.surfacePrimary.opacity(0.94), in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(Color.borderSubtle, lineWidth: 1))
    }
}

private struct SettingsSection<Content: View>: View {
    let title: String
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title)
                .font(.system(size: 13, weight: .bold, design: .rounded))
                .foregroundStyle(Color.textSecondary)
                .textCase(.uppercase)

            VStack(spacing: 0) {
                content
            }
            .background(Color.surfacePrimary.opacity(0.94), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(Color.borderSubtle, lineWidth: 1))
        }
    }
}

private struct SettingsRow: View {
    let icon: String
    let title: String
    let value: String
    let tint: Color

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(tint)
                .frame(width: 34, height: 34)
                .background(Color.surfaceRaised, in: Circle())

            Text(title)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Color.textPrimary)

            Spacer(minLength: 12)

            Text(value)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Color.textSecondary)
                .lineLimit(2)
                .minimumScaleFactor(0.78)
                .multilineTextAlignment(.trailing)
                .truncationMode(.middle)
        }
        .padding(.horizontal, 14)
        .frame(minHeight: 58)
    }
}

private struct SettingsLogoutButton: View {
    let isLoading: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: "rectangle.portrait.and.arrow.right")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(Color.feedbackCritical)
                    .frame(width: 34, height: 34)
                    .background(Color.surfaceRaised, in: Circle())

                Text("Log out")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Color.feedbackCritical)

                Spacer()

                if isLoading {
                    ProgressView()
                        .tint(.feedbackCritical)
                }
            }
            .padding(.horizontal, 14)
            .frame(minHeight: 58)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(isLoading)
        .accessibilityLabel("Log out")
    }
}

private struct SettingsDivider: View {
    var body: some View {
        Rectangle()
            .fill(Color.borderSubtle)
            .frame(height: 1)
            .padding(.leading, 60)
    }
}

private enum SettingsDateFormatting {
    static func title(for localDate: String) -> String {
        let parser = DateFormatter()
        parser.calendar = Calendar(identifier: .gregorian)
        parser.locale = Locale(identifier: "en_US_POSIX")
        parser.dateFormat = "yyyy-MM-dd"

        guard let date = parser.date(from: localDate) else { return localDate }

        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter.string(from: date)
    }

    static func dateTime(_ date: Date?) -> String {
        guard let date else { return "Unavailable" }
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter.string(from: date)
    }
}
