import ComposableArchitecture
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
    let store: StoreOf<VestaRootFeature>

    init(
        store: StoreOf<VestaRootFeature> = Store(initialState: VestaRootFeature.State()) {
            VestaRootFeature()
        }
    ) {
        self.store = store
    }

    var body: some View {
        VestaAuthGate(store: store)
        .prefetchClerkImages()
        .environment(Clerk.shared)
    }
}

struct VestaAuthGate: View {
    let store: StoreOf<VestaRootFeature>

    var body: some View {
        Group {
            switch VestaAuthPresentationPolicy.evaluate(sessionState: store.sessionState) {
            case .loading:
                VestaAuthLoadingView()
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

struct VestaAuthClient {
    var authStates: @Sendable () -> AsyncStream<VestaAuthSessionState>
    var handleOpenURL: @Sendable (_ url: URL) async -> Void
    var signOut: @Sendable () async throws -> Void
    var storeUser: @Sendable () async throws -> Void
}

extension VestaAuthClient: DependencyKey {
    static let liveValue = VestaAuthClient(
        authStates: {
            AsyncStream { continuation in
                let task = Task { @MainActor in
                    for await state in vestaConvexClient.authState.values {
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

    private static func sessionState(from authState: AuthState<String>) -> VestaAuthSessionState {
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
        let _: ConvexStoreUserResponse? = try await vestaConvexClient.mutation("users:store", with: args)
    }
}

extension DependencyValues {
    var vestaAuthClient: VestaAuthClient {
        get { self[VestaAuthClient.self] }
        set { self[VestaAuthClient.self] = newValue }
    }
}

@Reducer
struct VestaRootFeature {
    @ObservableState
    struct State {
        var capture = VestaCaptureFeature.State()
        var sessionState: VestaAuthSessionState = .loading
    }

    enum Action {
        case authStateChanged(VestaAuthSessionState)
        case capture(VestaCaptureFeature.Action)
        case openURL(URL)
        case storeUserResponse(Result<Void, VestaClientFailure>)
        case task
    }

    @Dependency(\.vestaAuthClient) private var auth

    private enum CancelID {
        case authStates
    }

    var body: some ReducerOf<Self> {
        Scope(state: \.capture, action: \.capture) {
            VestaCaptureFeature()
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
                            await send(.storeUserResponse(.failure(VestaClientFailure(error: error))))
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
