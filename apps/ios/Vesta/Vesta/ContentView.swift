import PencilKit
import SwiftUI
import UIKit

struct ContentView: View {
    @StateObject private var model = VestaCaptureViewModel()
    @Environment(\.scenePhase) private var scenePhase
    @FocusState private var captureFocused: CaptureFocusTarget?
    @State private var navigationPath: [VestaDestination] = []
    @State private var activeSheet: VestaSheet?
    @State private var addMenuOpen = false
    @State private var drawingOpen = false
    @State private var formattingOpen = false
    @State private var imagePickerSource: CaptureImagePickerSource?
    @State private var voiceRecorderOpen = false

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
                    TopChrome(
                        dailyStreak: model.dailyStreak,
                        signal: model.chromeSignal,
                        perform: perform
                    )
                        .padding(.horizontal, 24)
                        .padding(.top, 14)

                    CaptureCanvas(
                        model: model,
                        focused: $captureFocused
                    )
                        .padding(.horizontal, 26)
                        .padding(.top, 48)
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                }
            }
            .safeAreaInset(edge: .bottom) {
                BottomCaptureRail(
                    hasDraft: model.hasDraft,
                    saving: model.saving,
                    addMenuOpen: $addMenuOpen,
                    formattingOpen: $formattingOpen,
                    openCamera: {
                        if UIImagePickerController.isSourceTypeAvailable(.camera) {
                            imagePickerSource = .camera
                        } else {
                            model.errorMessage = "Camera is not available on this device."
                        }
                    },
                    openDrawing: { drawingOpen = true },
                    openPhotoLibrary: { imagePickerSource = .photoLibrary },
                    openVoiceRecorder: { voiceRecorderOpen = true },
                    requestSuggestion: {
                        model.addJournalingSuggestion()
                        captureFocused = model.shouldFocusContinuationDraft || !model.attachments.isEmpty ? .trailingDraft : .draft
                    },
                    applyFormat: {
                        model.applyTextFormat($0)
                        captureFocused = model.shouldFocusContinuationDraft || !model.attachments.isEmpty ? .trailingDraft : .draft
                    },
                    submit: {
                        Task {
                            await model.submit()
                            if model.shouldFocusContinuationDraft {
                                captureFocused = .trailingDraft
                            }
                        }
                    }
                )
                .padding(.horizontal, 24)
                .padding(.bottom, 14)
            }
            .navigationDestination(for: VestaDestination.self) { destination in
                switch destination {
                case .settings:
                    SettingsScreen(model: model)
                case .todayCalendar:
                    TodayCalendarScreen(model: model)
                }
            }
        }
        .preferredColorScheme(.dark)
        .task { await model.refreshContext() }
        .task(id: model.shouldPollProcessing) {
            if model.shouldPollProcessing {
                await model.pollProcessingResult()
            }
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active {
                Task { await model.refreshContext() }
            }
        }
        .alert("Interrupt processing?", isPresented: processingEditAlertPresented) {
            Button("Keep processing", role: .cancel) {
                model.cancelProcessingEditInterruption()
            }
            Button("Edit note", role: .destructive) {
                model.confirmProcessingEditInterruption()
                captureFocused = .draft
            }
        } message: {
            Text("Editing this note will stop tracking the current processing. You can submit the edited note again when you're ready.")
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
        .sheet(item: $imagePickerSource) { source in
            SystemImagePicker(source: source) { image in
                model.appendImage(image, source: source)
                captureFocused = .trailingDraft
            }
        }
        .fullScreenCover(isPresented: $drawingOpen) {
            DrawingSheet { drawing in
                model.appendDrawing(drawing)
                captureFocused = .trailingDraft
            }
        }
        .fullScreenCover(item: $model.editingDrawing) { attachment in
            DrawingSheet(initialDrawing: attachment.drawing ?? PKDrawing()) { drawing in
                model.updateDrawing(attachment, drawing: drawing)
            }
        }
        .sheet(item: $model.previewedAttachment) { attachment in
            AttachmentPreviewSheet(attachment: attachment)
        }
        .sheet(isPresented: $voiceRecorderOpen) {
            VoiceRecorderSheet { url in
                model.appendVoiceRecording(url)
                captureFocused = .trailingDraft
            }
            .presentationDetents([.height(320)])
        }
    }

    private var processingEditAlertPresented: Binding<Bool> {
        Binding(
            get: { model.activeAlert == .processingEditInterruption },
            set: { isPresented in
                if !isPresented {
                    model.cancelProcessingEditInterruption()
                }
            }
        )
    }

    private func perform(_ action: VestaChromeAction) {
        if action == .statusSignal {
            if model.latestResult != nil {
                model.openLatestResult()
            } else {
                Task { await model.refreshContext() }
            }
            return
        }

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
