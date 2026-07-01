import ClerkKit
import ClerkKitUI
import ConvexMobile
import SwiftUI

enum VestaClerkConfig {
    static var publishableKey: String? {
        normalized(Bundle.main.object(forInfoDictionaryKey: "ClerkPublishableKey") as? String)
            ?? normalized(ProcessInfo.processInfo.environment["CLERK_PUBLISHABLE_KEY"])
    }

    private static func normalized(_ value: String?) -> String? {
        guard let value else { return nil }
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.hasPrefix("pk_") ? trimmed : nil
    }
}

struct VestaAuthenticatedRoot: View {
    var body: some View {
        VestaAuthGate {
            ContentView()
        }
        .prefetchClerkImages()
        .environment(Clerk.shared)
    }
}

struct VestaAuthGate<Content: View>: View {
    @State private var authState: AuthState<String> = .loading
    let content: () -> Content

    var body: some View {
        Group {
            switch VestaAuthPresentationPolicy.evaluate(sessionState: sessionState) {
            case .loading:
                VestaAuthLoadingView()
            case .authForm:
                AuthView()
            case .content:
                content()
            }
        }
        .task {
            for await state in vestaConvexClient.authState.values {
                authState = state
            }
        }
        .task(id: sessionState) {
            guard sessionState == .signedIn else { return }
            let args = [String: ConvexEncodable?]()
            let _: ConvexStoreUserResponse? = try? await vestaConvexClient.mutation("users:store", with: args)
        }
        .onOpenURL { url in
            Task {
                try? await Clerk.shared.handle(url)
            }
        }
    }

    private var sessionState: VestaAuthSessionState {
        switch authState {
        case .loading:
            .loading
        case .unauthenticated:
            .signedOut
        case .authenticated:
            .signedIn
        }
    }
}

struct VestaAuthLoadingView: View {
    var body: some View {
        ZStack {
            Color.appBackground.ignoresSafeArea()
            ProgressView()
                .tint(.textPrimary)
        }
    }
}

struct VestaMissingClerkConfigurationView: View {
    var body: some View {
        ZStack {
            Color.appBackground.ignoresSafeArea()
            VStack(alignment: .leading, spacing: 12) {
                Text("Clerk is not configured")
                    .font(.system(size: 24, weight: .semibold, design: .rounded))
                    .foregroundStyle(Color.textPrimary)
                Text("Set CLERK_PUBLISHABLE_KEY for this iOS build before testing authenticated sync.")
                    .font(.system(size: 15, weight: .medium, design: .rounded))
                    .foregroundStyle(Color.textSecondary)
                    .lineSpacing(4)
            }
            .padding(28)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}
