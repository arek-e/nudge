import ComposableArchitecture
import ClerkKit
import ClerkKitUI
import ConvexMobile
import SwiftUI

enum NudgeClerkConfig {
    static var publishableKey: String? {
        normalized(Bundle.main.object(forInfoDictionaryKey: "ClerkPublishableKey") as? String)
            ?? normalized(ProcessInfo.processInfo.environment["CLERK_PUBLISHABLE_KEY"])
    }

    static var proxyURL: String? {
        normalizedURL(Bundle.main.object(forInfoDictionaryKey: "ClerkProxyURL") as? String)
            ?? normalizedURL(ProcessInfo.processInfo.environment["CLERK_PROXY_URL"])
    }

    private static func normalized(_ value: String?) -> String? {
        guard let value else { return nil }
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.hasPrefix("pk_") ? trimmed : nil
    }

    private static func normalizedURL(_ value: String?) -> String? {
        guard let value else { return nil }
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, !trimmed.contains("$(") else { return nil }
        guard let url = URL(string: trimmed), url.scheme != nil, url.host != nil else { return nil }
        return trimmed
    }
}

struct NudgeAuthenticatedRoot: View {
    let store: StoreOf<NudgeRootFeature>

    init(
        store: StoreOf<NudgeRootFeature> = Store(initialState: NudgeRootFeature.State()) {
            NudgeRootFeature()
        }
    ) {
        self.store = store
    }

    var body: some View {
        NudgeAuthGate(store: store)
        .prefetchClerkImages()
        .environment(Clerk.shared)
    }
}

struct NudgeAuthGate: View {
    let store: StoreOf<NudgeRootFeature>

    var body: some View {
        Group {
            switch NudgeAuthPresentationPolicy.evaluate(sessionState: store.sessionState) {
            case .loading:
                NudgeAuthLoadingView()
            case .authForm:
                AuthView()
            case .content:
                ContentView(
                    store: store.scope(state: \.capture, action: \.capture)
                )
            }
        }
        .task {
            await store.send(.task).finish()
        }
        .onOpenURL { url in
            store.send(.openURL(url))
        }
    }
}

struct NudgeAuthClient {
    var authStates: @Sendable () -> AsyncStream<NudgeAuthSessionState>
    var handleOpenURL: @Sendable (_ url: URL) async -> Void
    var signOut: @Sendable () async throws -> Void
    var storeUser: @Sendable () async throws -> Void
}

extension NudgeAuthClient: DependencyKey {
    static let liveValue = NudgeAuthClient(
        authStates: {
            AsyncStream { continuation in
                let task = Task { @MainActor in
                    for await state in nudgeConvexClient.authState.values {
                        continuation.yield(Self.sessionState(from: state))
                    }
                    continuation.finish()
                }
                continuation.onTermination = { _ in task.cancel() }
            }
        },
        handleOpenURL: { url in
            await Self.handle(url: url)
        },
        signOut: {
            try await Self.signOut()
        },
        storeUser: {
            try await Self.storeUser()
        }
    )

    private static func sessionState(from authState: AuthState<String>) -> NudgeAuthSessionState {
        switch authState {
        case .loading:
            .loading
        case .unauthenticated:
            .signedOut
        case .authenticated:
            .signedIn
        }
    }

    @MainActor
    private static func handle(url: URL) async {
        _ = try? await Clerk.shared.handle(url)
    }

    @MainActor
    private static func signOut() async throws {
        if let sessionId = Clerk.shared.session?.id {
            try await Clerk.shared.auth.signOut(sessionId: sessionId)
        } else {
            try await Clerk.shared.auth.signOut()
        }
    }

    @MainActor
    private static func storeUser() async throws {
        let args = [String: ConvexEncodable?]()
        let _: ConvexStoreUserResponse? = try await nudgeConvexClient.mutation("users:store", with: args)
    }
}

extension DependencyValues {
    var nudgeAuthClient: NudgeAuthClient {
        get { self[NudgeAuthClient.self] }
        set { self[NudgeAuthClient.self] = newValue }
    }
}

@Reducer
struct NudgeRootFeature {
    @ObservableState
    struct State {
        var capture = NudgeCaptureFeature.State()
        var sessionState: NudgeAuthSessionState = .loading
    }

    enum Action {
        case authStateChanged(NudgeAuthSessionState)
        case capture(NudgeCaptureFeature.Action)
        case openURL(URL)
        case storeUserResponse(Result<Void, NudgeClientFailure>)
        case task
    }

    @Dependency(\.nudgeAuthClient) private var auth

    private enum CancelID {
        case authStates
    }

    var body: some ReducerOf<Self> {
        Scope(state: \.capture, action: \.capture) {
            NudgeCaptureFeature()
        }

        Reduce { state, action in
            switch action {
            case .authStateChanged(let sessionState):
                state.sessionState = sessionState
                guard sessionState == .signedIn else { return .none }
                return .merge(
                    .run { send in
                        do {
                            try await auth.storeUser()
                            await send(.storeUserResponse(.success(())))
                        } catch {
                            await send(.storeUserResponse(.failure(NudgeClientFailure(error: error))))
                        }
                    },
                    .send(.capture(.task))
                )

            case .capture:
                return .none

            case .openURL(let url):
                return .run { _ in
                    await auth.handleOpenURL(url)
                }

            case .storeUserResponse:
                return .none

            case .task:
                return .run { send in
                    for await sessionState in auth.authStates() {
                        await send(.authStateChanged(sessionState))
                    }
                }
                .cancellable(id: CancelID.authStates, cancelInFlight: true)
            }
        }
    }
}

struct NudgeAuthLoadingView: View {
    var body: some View {
        ZStack {
            Color.appBackground.ignoresSafeArea()
            ProgressView()
                .tint(.textPrimary)
        }
    }
}

struct NudgeMissingClerkConfigurationView: View {
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
