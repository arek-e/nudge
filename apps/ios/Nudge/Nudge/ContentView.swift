import ComposableArchitecture
import PencilKit
import SwiftUI
import UIKit

struct ContentView: View {
    @Bindable var store: StoreOf<NudgeCaptureFeature>
    @Environment(\.scenePhase) private var scenePhase
    @FocusState private var captureFocused: CaptureFocusTarget?

    var body: some View {
        NavigationStack(path: $store.navigationPath) {
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
                    TopChrome(
                        dailyStreak: store.dailyStreak,
                        signal: store.chromeSignal,
                        perform: { store.send(.chromeActionTapped($0)) }
                    )
                        .padding(.horizontal, 24)
                        .padding(.top, 14)

                    SyncStatusMatrixView(snapshot: store.syncStatusMatrix)
                        .padding(.horizontal, 24)
                        .padding(.top, 14)

                    CaptureCanvas(
                        store: store,
                        focused: $captureFocused
                    )
                        .padding(.horizontal, 26)
                        .padding(.top, 28)
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                }
            }
            .safeAreaInset(edge: .bottom) {
                BottomCaptureRail(
                    hasDraft: store.hasDraft,
                    saving: store.saving,
                    addMenuOpen: $store.addMenuOpen,
                    formattingOpen: $store.formattingOpen,
                    openCamera: {
                        if UIImagePickerController.isSourceTypeAvailable(.camera) {
                            store.send(.cameraButtonTapped(isAvailable: true))
                        } else {
                            store.send(.cameraButtonTapped(isAvailable: false))
                        }
                    },
                    openDrawing: { store.send(.drawingButtonTapped) },
                    openPhotoLibrary: { store.send(.photoLibraryButtonTapped) },
                    openVoiceRecorder: { store.send(.voiceRecorderButtonTapped) },
                    requestSuggestion: {
                        store.send(.addJournalingSuggestion)
                        captureFocused = store.shouldFocusContinuationDraft || !store.attachments.isEmpty ? .trailingDraft : .draft
                    },
                    applyFormat: {
                        store.send(.applyTextFormat($0))
                        captureFocused = store.shouldFocusContinuationDraft || !store.attachments.isEmpty ? .trailingDraft : .draft
                    },
                    submit: {
                        Task {
                            await store.send(.submit).finish()
                            if store.shouldFocusContinuationDraft {
                                captureFocused = .trailingDraft
                            }
                        }
                    }
                )
                .padding(.horizontal, 24)
                .padding(.bottom, 14)
            }
            .navigationDestination(for: NudgeDestination.self) { destination in
                switch destination {
                case .dailyReview:
                    DailyReviewScreen(store: store)
                case .settings:
                    SettingsScreen(store: store)
                case .todayCalendar:
                    TodayCalendarScreen(store: store)
                }
            }
        }
        .preferredColorScheme(.dark)
        .task { await store.send(.refreshContext).finish() }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active {
                Task { await store.send(.refreshContext).finish() }
            }
        }
        .alert("Interrupt processing?", isPresented: processingEditAlertPresented) {
            Button("Keep processing", role: .cancel) {
                store.send(.cancelProcessingEditInterruption)
            }
            Button("Edit note", role: .destructive) {
                store.send(.confirmProcessingEditInterruption)
                captureFocused = .draft
            }
        } message: {
            Text("Editing this note will stop tracking the current processing. You can submit the edited note again when you're ready.")
        }
        .sheet(item: presentedResultBinding) { result in
            CaptureDetailSheet(result: result)
                .presentationDetents([.fraction(0.72), .large])
                .presentationDragIndicator(.hidden)
        }
        .sheet(item: activeSheetBinding) { sheet in
            switch sheet {
            case .streakCalendar:
                StreakCalendarSheet(store: store)
                    .presentationDetents([.fraction(0.78), .large])
                    .presentationDragIndicator(.visible)
            }
        }
        .sheet(item: imagePickerSourceBinding) { source in
            SystemImagePicker(source: source) { image in
                store.send(.appendImage(image, source))
                captureFocused = .trailingDraft
            }
        }
        .fullScreenCover(isPresented: drawingOpenBinding) {
            DrawingSheet { drawing in
                store.send(.appendDrawing(drawing))
                captureFocused = .trailingDraft
            }
        }
        .fullScreenCover(item: editingDrawingBinding) { attachment in
            DrawingSheet(initialDrawing: attachment.drawing ?? PKDrawing()) { drawing in
                store.send(.updateDrawing(attachment, drawing))
            }
        }
        .sheet(item: previewedAttachmentBinding) { attachment in
            AttachmentPreviewSheet(attachment: attachment)
        }
        .sheet(isPresented: voiceRecorderOpenBinding) {
            VoiceRecorderSheet { url in
                store.send(.appendVoiceRecording(url))
                captureFocused = .trailingDraft
            }
            .presentationDetents([.height(320)])
        }
    }

    private var processingEditAlertPresented: Binding<Bool> {
        Binding(
            get: { store.activeAlert == .processingEditInterruption },
            set: { isPresented in
                if !isPresented {
                    store.send(.cancelProcessingEditInterruption)
                }
            }
        )
    }

    private var activeSheetBinding: Binding<NudgeSheet?> {
        Binding(
            get: { store.activeSheet },
            set: { store.send(.activeSheetChanged($0)) }
        )
    }

    private var drawingOpenBinding: Binding<Bool> {
        Binding(
            get: { store.drawingOpen },
            set: { store.send(.drawingOpenChanged($0)) }
        )
    }

    private var editingDrawingBinding: Binding<CaptureAttachment?> {
        Binding(
            get: { store.editingDrawing },
            set: { store.send(.editingDrawingChanged($0)) }
        )
    }

    private var imagePickerSourceBinding: Binding<CaptureImagePickerSource?> {
        Binding(
            get: { store.imagePickerSource },
            set: { store.send(.imagePickerSourceChanged($0)) }
        )
    }

    private var presentedResultBinding: Binding<CaptureResult?> {
        Binding(
            get: { store.presentedResult },
            set: { store.send(.presentedResultChanged($0)) }
        )
    }

    private var previewedAttachmentBinding: Binding<CaptureAttachment?> {
        Binding(
            get: { store.previewedAttachment },
            set: { store.send(.previewedAttachmentChanged($0)) }
        )
    }

    private var voiceRecorderOpenBinding: Binding<Bool> {
        Binding(
            get: { store.voiceRecorderOpen },
            set: { store.send(.voiceRecorderOpenChanged($0)) }
        )
    }
}

struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView(
            store: Store(initialState: NudgeCaptureFeature.State()) {
                NudgeCaptureFeature()
            }
        )
    }
}
