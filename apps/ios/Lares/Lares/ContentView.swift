import SwiftUI

struct ContentView: View {
    @StateObject private var model = LaresCaptureViewModel()
    @Environment(\.scenePhase) private var scenePhase
    @FocusState private var captureFocused: Bool
    @State private var navigationPath: [LaresDestination] = []
    @State private var activeSheet: LaresSheet?

    var body: some View {
        NavigationStack(path: $navigationPath) {
            ZStack {
                Color.appBackground.ignoresSafeArea()
                LinearGradient(
                    colors: [
                        Color.surfacePrimary.opacity(0.58),
                        Color.appBackground,
                        Color.appBackground
                    ],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .ignoresSafeArea()

                VStack(spacing: 0) {
                    TopChrome(dailyStreak: model.dailyStreak, perform: perform)
                        .padding(.horizontal, 24)
                        .padding(.top, 14)

                    CaptureCanvas(model: model, focused: $captureFocused)
                        .padding(.horizontal, 26)
                        .padding(.top, 48)

                    Spacer(minLength: 0)
                }
            }
            .safeAreaInset(edge: .bottom) {
                BottomCaptureRail(
                    hasDraft: model.hasDraft,
                    latestResult: model.latestResult,
                    saving: model.saving,
                    focusInput: { captureFocused = true },
                    addLine: { model.addLine() },
                    submit: { Task { await model.submit() } }
                )
                .padding(.horizontal, 24)
                .padding(.bottom, 14)
            }
            .navigationDestination(for: LaresDestination.self) { destination in
                switch destination {
                case .todayCalendar:
                    TodayCalendarScreen(model: model)
                }
            }
        }
        .preferredColorScheme(.dark)
        .task { await model.refreshContext() }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active {
                Task { await model.refreshContext() }
            }
        }
        .sheet(item: $model.presentedResult) { result in
            CaptureDetailSheet(result: result)
                .presentationDetents([.fraction(0.72), .large])
                .presentationDragIndicator(.hidden)
        }
        .sheet(item: $activeSheet) { sheet in
            switch sheet {
            case .streakCalendar:
                StreakCalendarSheet(model: model)
                    .presentationDetents([.fraction(0.78), .large])
                    .presentationDragIndicator(.visible)
            }
        }
    }

    private func perform(_ action: LaresChromeAction) {
        if let destination = action.destination {
            navigationPath.append(destination)
        }
        if let sheet = action.sheet {
            activeSheet = sheet
        }
    }
}

struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView()
    }
}
