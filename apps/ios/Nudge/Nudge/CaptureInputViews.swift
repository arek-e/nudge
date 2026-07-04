import AVFoundation
import ComposableArchitecture
import PencilKit
import SwiftUI
import UIKit

struct NudgeLogo: View {
    var body: some View {
        HStack(spacing: 8) {
            ZStack {
                RoundedRectangle(cornerRadius: 7, style: .continuous)
                    .fill(Color.surfacePrimary.opacity(0.95))
                RoundedRectangle(cornerRadius: 7, style: .continuous)
                    .stroke(Color.borderSubtle, lineWidth: 1)
                Text("L")
                    .font(.system(size: 14, weight: .semibold, design: .monospaced))
                    .foregroundStyle(Color.textPrimary)
                Rectangle()
                    .fill(Color.accentSuccess)
                    .frame(width: 10, height: 2)
                    .offset(y: 9)
            }
            .frame(width: 28, height: 28)

            Text("Nudge")
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(Color.textPrimary)
        }
    }
}

enum CaptureImagePickerSource: String, Identifiable {
    case camera
    case photoLibrary

    var id: String { rawValue }

    var pickerSourceType: UIImagePickerController.SourceType {
        switch self {
        case .camera:
            .camera
        case .photoLibrary:
            .photoLibrary
        }
    }
}

struct CaptureCanvas: View {
    @Bindable var store: StoreOf<NudgeCaptureFeature>
    var focused: FocusState<CaptureFocusTarget?>.Binding

    var body: some View {
        let layout = CaptureWritingLayoutPolicy.evaluate(
            hasAttachments: !store.attachments.isEmpty,
            hasDraftText: !store.draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
            hasPendingResult: store.hasPendingResult,
            stage: store.stage
        )

        ScrollViewReader { proxy in
            ScrollView(.vertical, showsIndicators: false) {
                VStack(alignment: .leading, spacing: 14) {
                    ForEach(store.retainedRows) { row in
                        RetainedCaptureRowView(row: row)
                    }

                    if layout.showsLeadingDraft {
                        draftField(
                            "What matters now?",
                            text: draftText,
                            target: .draft,
                            usesWorkingOverlay: layout.leadingDraftUsesWorkingOverlay
                        )
                        .id(CaptureScrollID.leadingDraft)
                    }

                    if !store.attachments.isEmpty {
                        AttachmentPreviewRail(
                            attachments: store.attachments,
                            open: { store.send(.openAttachment($0)) },
                            remove: { store.send(.removeAttachment($0)) }
                        )
                    }

                    if layout.showsContinuationDraft {
                        draftField(
                            "Keep writing...",
                            text: trailingDraftText,
                            target: .trailingDraft,
                            usesWorkingOverlay: false
                        )
                        .id(CaptureScrollID.continuationDraft)
                    }

                    if !store.errorMessage.isEmpty {
                        Text(store.errorMessage)
                            .font(.system(size: 13, weight: .medium, design: .rounded))
                            .foregroundStyle(Color.feedbackCritical)
                            .padding(.horizontal, 2)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .topLeading)
                .padding(.bottom, 120)
            }
            .scrollDismissesKeyboard(.interactively)
            .onChange(of: focused.wrappedValue) { _, _ in
                scrollToActiveField(proxy, layout: layout)
            }
            .onChange(of: store.draft) { _, _ in
                scrollToActiveField(proxy, layout: layout)
            }
            .onChange(of: store.trailingDraft) { _, _ in
                scrollToActiveField(proxy, layout: layout)
            }
            .onChange(of: store.retainedRows.count) { _, _ in
                scrollToActiveField(proxy, layout: layout)
            }
            .onChange(of: store.stage) { _, _ in
                scrollToActiveField(proxy, layout: layout)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    private func scrollToActiveField(_ proxy: ScrollViewProxy, layout: CaptureWritingLayout) {
        let behavior = CaptureScrollTargetPolicy.evaluate(
            focusedTarget: focused.wrappedValue,
            showsContinuationDraft: layout.showsContinuationDraft
        )
        let target = scrollID(for: behavior.target)
        let scroll = {
            proxy.scrollTo(target, anchor: .bottom)
        }

        if behavior.usesSmoothAnimation {
            withAnimation(.easeInOut(duration: 0.24), scroll)
        } else {
            scroll()
        }
    }

    private func scrollID(for target: CaptureScrollTarget) -> CaptureScrollID {
        switch target {
        case .leadingDraft:
            .leadingDraft
        case .continuationDraft:
            .continuationDraft
        }
    }

    private func draftField(
        _ placeholder: String,
        text: Binding<String>,
        target: CaptureFocusTarget,
        usesWorkingOverlay: Bool
    ) -> some View {
        ZStack(alignment: .topLeading) {
            TextField(placeholder, text: text, axis: .vertical)
                .focused(focused, equals: target)
                .submitLabel(target == .trailingDraft ? .return : .done)
                .onSubmit {
                    Task {
                        await store.send(.submit).finish()
                        if store.shouldFocusContinuationDraft {
                            focused.wrappedValue = .trailingDraft
                        }
                    }
                }
                .textInputAutocapitalization(.sentences)
                .autocorrectionDisabled(false)
                .font(.system(size: 25, weight: .semibold, design: .rounded))
                .foregroundStyle(usesWorkingOverlay && !text.wrappedValue.isEmpty ? Color.clear : Color.textPrimary)
                .lineLimit(1...12)
                .fixedSize(horizontal: false, vertical: true)

            if usesWorkingOverlay && !text.wrappedValue.isEmpty {
                ShimmeringNoteText(text: text.wrappedValue)
                    .allowsHitTesting(false)
            }
        }
    }

    private var draftText: Binding<String> {
        Binding(
            get: { store.draft },
            set: { store.send(.draftChanged($0)) }
        )
    }

    private var trailingDraftText: Binding<String> {
        Binding(
            get: { store.trailingDraft },
            set: { store.send(.trailingDraftChanged($0)) }
        )
    }
}

private enum CaptureScrollID: Hashable {
    case leadingDraft
    case continuationDraft
}

struct RetainedCaptureRowView: View {
    let row: RetainedCaptureRow

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Text(row.noteText)
                .font(.system(size: 25, weight: .semibold, design: .rounded))
                .foregroundStyle(Color.textPrimary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .fixedSize(horizontal: false, vertical: true)

            StatusChip(stage: row.stage, result: nil, openResult: {})
                .padding(.top, 4)
                .layoutPriority(1)
        }
        .frame(maxWidth: .infinity, alignment: .topLeading)
    }
}

struct AttachmentPreviewRail: View {
    let attachments: [CaptureAttachment]
    let open: (CaptureAttachment) -> Void
    let remove: (CaptureAttachment) -> Void

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 12) {
                ForEach(attachments) { attachment in
                    AttachmentPreviewCard(
                        attachment: attachment,
                        open: { open(attachment) },
                        remove: { remove(attachment) }
                    )
                }
            }
            .padding(.vertical, 2)
        }
    }
}

struct AttachmentPreviewCard: View {
    let attachment: CaptureAttachment
    let open: () -> Void
    let remove: () -> Void

    var body: some View {
        ZStack(alignment: .topTrailing) {
            Button(action: open) {
                Group {
                    if let thumbnail = attachment.thumbnail {
                        if attachment.kind == .drawing {
                            Image(uiImage: thumbnail)
                                .resizable()
                                .scaledToFit()
                                .padding(6)
                        } else {
                            Image(uiImage: thumbnail)
                                .resizable()
                                .scaledToFill()
                        }
                    } else {
                        VStack(spacing: 8) {
                            Image(systemName: attachment.kind.icon)
                                .font(.system(size: 22, weight: .semibold))
                            Text(attachment.label)
                                .font(.system(size: 12, weight: .semibold, design: .rounded))
                                .lineLimit(2)
                                .multilineTextAlignment(.center)
                        }
                        .foregroundStyle(Color.textPrimary)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .background(Color.surfaceRaised)
                    }
                }
                .frame(width: 104, height: 104)
                .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                .overlay {
                    if attachment.kind != .drawing {
                        RoundedRectangle(cornerRadius: 18, style: .continuous)
                            .stroke(Color.borderSubtle, lineWidth: 1)
                    }
                }
                .shadow(color: attachment.kind == .drawing ? .clear : .shadowAmbient, radius: 12, y: 8)
            }
            .buttonStyle(.plain)

            Menu {
                Button(action: open) {
                    Label(attachment.kind == .drawing ? "Edit Drawing" : "Preview", systemImage: attachment.kind == .drawing ? "pencil" : "eye")
                }

                Button(role: .destructive, action: remove) {
                    Label("Delete", systemImage: "trash")
                }
            } label: {
                Image(systemName: "ellipsis")
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(Color.textPrimary)
                    .frame(width: 30, height: 30)
                    .background(Color.appBackground.opacity(0.88), in: Circle())
            }
            .padding(6)
            .accessibilityLabel("Attachment actions")
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(attachment.label) attachment")
        .accessibilityHint(attachment.kind == .drawing ? "Opens drawing editor" : "Opens preview")
    }
}

struct StatusChip: View {
    let stage: CaptureStage
    let result: CaptureResult?
    let openResult: () -> Void

    var body: some View {
        let placement = CaptureResultPlacementPolicy.evaluate(
            hasLatestResult: result != nil,
            stage: stage
        )

        Group {
            if placement.showsInlineResult, let result {
                Button(action: openResult) {
                    CompactResultDetail(result: result)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(
                    CaptureInlineResultSummaryPolicy.evaluate(
                        actionCount: result.actionCount,
                        signalCount: result.signalCount,
                        sourceCount: result.sourceCount
                    ).accessibilityLabel
                )
            } else if let label = stage.label {
                HStack(spacing: 7) {
                    if stage == .saved {
                        Image(systemName: "sparkles")
                            .foregroundStyle(Color.accentInsight)
                    }

                    if stage.isWorking {
                        ShimmeringStatusText(text: label)
                    } else {
                        Text(label)
                            .font(.system(size: 16, weight: .semibold, design: .rounded))
                            .foregroundStyle(stage == .saved ? Color.textPrimary : Color.textSecondary)
                    }
                }
            }
        }
        .lineLimit(1)
        .fixedSize(horizontal: true, vertical: false)
    }
}

struct CompactResultDetail: View {
    let result: CaptureResult

    var body: some View {
        let summary = CaptureInlineResultSummaryPolicy.evaluate(
            actionCount: result.actionCount,
            signalCount: result.signalCount,
            sourceCount: result.sourceCount
        )

        HStack(spacing: 5) {
            ForEach(Array(summary.metricTexts.enumerated()), id: \.offset) { index, text in
                if index > 0 {
                    Circle()
                        .fill(Color.textSecondary.opacity(0.32))
                        .frame(width: 3, height: 3)
                }

                Text(text)
                    .fontDesign(.rounded)
                    .foregroundStyle(index == 0 ? Color.textPrimary : Color.textSecondary)
                    .monospacedDigit()
            }
        }
        .font(.system(size: 12, weight: .semibold, design: .rounded))
        .lineLimit(1)
        .padding(.horizontal, 2)
        .frame(minWidth: 44, minHeight: 32, alignment: .trailing)
        .contentShape(Rectangle())
    }
}

struct ShimmeringStatusText: View {
    let text: String

    var body: some View {
        NudgeShimmeringText(
            text: text,
            font: .system(size: 16, weight: .semibold, design: .rounded),
            textColor: Color.textSecondary,
            highlightColor: Color.shimmerSubtle,
            maxLines: 1,
            duration: 1.5
        )
        .fixedSize(horizontal: true, vertical: false)
    }
}

struct ShimmeringNoteText: View {
    let text: String

    var body: some View {
        NudgeShimmeringText(
            text: text,
            font: .system(size: 25, weight: .semibold, design: .rounded),
            textColor: Color.textPrimary,
            highlightColor: Color.shimmerStrong,
            maxLines: 5,
            duration: 1.35
        )
    }
}

struct NudgeShimmeringText: View {
    let text: String
    let font: Font
    let textColor: Color
    let highlightColor: Color
    let maxLines: Int
    let duration: TimeInterval

    var body: some View {
        TimelineView(.animation) { context in
            let phase = context.date.timeIntervalSinceReferenceDate
                .truncatingRemainder(dividingBy: duration) / duration

            Text(text)
                .font(font)
                .foregroundStyle(textColor)
                .lineLimit(maxLines)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
                .overlay(alignment: .topLeading) {
                    GeometryReader { geometry in
                        shimmer(in: geometry, phase: phase)
                    }
                    .mask(mask)
                    .blendMode(.plusLighter)
                }
        }
    }

    private var mask: some View {
        Text(text)
            .font(font)
            .lineLimit(maxLines)
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func shimmer(in geometry: GeometryProxy, phase: Double) -> some View {
        let bandWidth = max(geometry.size.width * 0.55, 84)

        return LinearGradient(
            colors: [.clear, highlightColor, .clear],
            startPoint: .leading,
            endPoint: .trailing
        )
        .frame(width: bandWidth, height: geometry.size.height)
        .offset(x: -bandWidth + phase * (geometry.size.width + bandWidth))
    }
}

struct BottomCaptureRail: View {
    let hasDraft: Bool
    let saving: Bool
    @Binding var addMenuOpen: Bool
    @Binding var formattingOpen: Bool
    let openCamera: () -> Void
    let openDrawing: () -> Void
    let openPhotoLibrary: () -> Void
    let openVoiceRecorder: () -> Void
    let requestSuggestion: () -> Void
    let applyFormat: (TextFormatAction) -> Void
    let submit: () -> Void

    var body: some View {
        HStack(spacing: 14) {
            RailButton(
                systemName: "plus",
                color: .textPrimary,
                accessibilityLabel: "Add attachment",
                action: { addMenuOpen = true }
            )
            .popover(isPresented: $addMenuOpen, arrowEdge: .bottom) {
                AttachmentActionPopover(
                    openVoiceRecorder: {
                        addMenuOpen = false
                        openVoiceRecorder()
                    },
                    openCamera: {
                        addMenuOpen = false
                        openCamera()
                    },
                    openPhotoLibrary: {
                        addMenuOpen = false
                        openPhotoLibrary()
                    },
                    openDrawing: {
                        addMenuOpen = false
                        openDrawing()
                    },
                    requestSuggestion: {
                        addMenuOpen = false
                        requestSuggestion()
                    }
                )
                .presentationCompactAdaptation(.popover)
            }

            RailTextButton(
                text: "Aa",
                accessibilityLabel: "Text formatting",
                action: { formattingOpen = true }
            )
            .popover(isPresented: $formattingOpen, arrowEdge: .bottom) {
                TextFormatPopover { action in
                    formattingOpen = false
                    applyFormat(action)
                }
                .presentationCompactAdaptation(.popover)
            }

            Spacer(minLength: 0)

            if hasDraft || saving {
                RailButton(
                    systemName: saving ? "hourglass" : "checkmark",
                    color: .textPrimary,
                    accessibilityLabel: saving ? "Saving" : "Submit note",
                    action: submit
                )
                    .transition(.scale(scale: 0.82).combined(with: .opacity))
            }
        }
        .frame(maxWidth: 430)
        .animation(.spring(response: 0.24, dampingFraction: 0.82), value: hasDraft)
        .animation(.spring(response: 0.24, dampingFraction: 0.82), value: saving)
    }
}

struct RailButton: View {
    let systemName: String
    let color: Color
    var accessibilityLabel: String?
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: systemName)
                .font(.system(size: 20, weight: .semibold))
                .foregroundStyle(color)
                .frame(width: 48, height: 48)
                .background(Color.surfaceRaised.opacity(0.96), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(Color.borderSubtle, lineWidth: 1))
                .shadow(color: .shadowAmbient, radius: 14, y: 10)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(accessibilityLabel ?? systemName)
    }
}

struct RailTextButton: View {
    let text: String
    let accessibilityLabel: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(text)
                .font(.system(size: 19, weight: .heavy, design: .rounded))
                .foregroundStyle(Color.textPrimary)
                .frame(width: 48, height: 48)
                .background(Color.surfaceRaised.opacity(0.96), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(Color.borderSubtle, lineWidth: 1))
                .shadow(color: .shadowAmbient, radius: 14, y: 10)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(accessibilityLabel)
    }
}

struct AttachmentActionPopover: View {
    let openVoiceRecorder: () -> Void
    let openCamera: () -> Void
    let openPhotoLibrary: () -> Void
    let openDrawing: () -> Void
    let requestSuggestion: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            PopoverActionRow(title: "Voice Recording", systemName: "mic.fill", action: openVoiceRecorder)
            PopoverDivider()
            PopoverActionRow(title: "Open Camera", systemName: "camera.fill", action: openCamera)
            PopoverDivider()
            PopoverActionRow(title: "Photo Library", systemName: "photo.fill", action: openPhotoLibrary)
            PopoverDivider()
            PopoverActionRow(title: "Draw", systemName: "scribble", action: openDrawing)
            PopoverDivider()
            PopoverActionRow(title: "Journaling Suggestions", systemName: "lightbulb", action: requestSuggestion)
        }
        .frame(width: 292)
        .background(Color.surfaceRaised)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .padding(4)
        .preferredColorScheme(.dark)
    }
}

struct TextFormatPopover: View {
    let apply: (TextFormatAction) -> Void

    var body: some View {
        VStack(spacing: 0) {
            PopoverActionRow(title: "Heading", systemName: "textformat.size", action: { apply(.heading) })
            PopoverDivider()
            PopoverActionRow(title: "Bold", systemName: "bold", action: { apply(.bold) })
            PopoverDivider()
            PopoverActionRow(title: "Italic", systemName: "italic", action: { apply(.italic) })
            PopoverDivider()
            PopoverActionRow(title: "Bulleted List", systemName: "list.bullet", action: { apply(.bullet) })
        }
        .frame(width: 236)
        .background(Color.surfaceRaised)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .padding(4)
        .preferredColorScheme(.dark)
    }
}

struct PopoverActionRow: View {
    let title: String
    let systemName: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 14) {
                Text(title)
                    .font(.system(size: 17, weight: .semibold, design: .rounded))
                    .foregroundStyle(Color.textPrimary)
                Spacer()
                Image(systemName: systemName)
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(Color.textPrimary)
                    .frame(width: 26)
            }
            .padding(.horizontal, 18)
            .frame(height: 54)
        }
        .buttonStyle(.plain)
    }
}

struct PopoverDivider: View {
    var body: some View {
        Rectangle()
            .fill(Color.borderSubtle)
            .frame(height: 1)
            .padding(.leading, 18)
    }
}

struct ResultMetricRail: View {
    let result: CaptureResult

    var body: some View {
        HStack(spacing: 10) {
            RailMetric(icon: "checkmark", text: "Saved", color: .accentSuccess)
            RailDivider()
            RailMetric(text: "\(result.signalCount) signals", color: .accentSignal)
            RailDivider()
            RailMetric(text: "\(result.actionCount) open", color: .accentInsight)
            RailDivider()
            RailMetric(icon: "link", text: "\(result.sourceCount)", color: .accentReference)
        }
        .font(.system(size: 14, weight: .semibold, design: .rounded))
        .padding(.horizontal, 18)
        .frame(minHeight: 54)
        .background(Color.surfaceRaised.opacity(0.96), in: Capsule())
        .shadow(color: .shadowAmbient, radius: 18, y: 10)
    }
}

struct RailMetric: View {
    var icon: String?
    let text: String
    let color: Color

    var body: some View {
        HStack(spacing: 5) {
            if let icon {
                Image(systemName: icon)
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(color)
            } else {
                Circle()
                    .fill(color)
                    .frame(width: 6, height: 6)
            }
            Text(text)
                .foregroundStyle(Color.textPrimary)
        }
    }
}

struct RailDivider: View {
    var body: some View {
        Circle()
            .fill(Color.textSecondary.opacity(0.22))
            .frame(width: 4, height: 4)
    }
}

struct SystemImagePicker: UIViewControllerRepresentable {
    let source: CaptureImagePickerSource
    let onImage: (UIImage) -> Void
    @Environment(\.dismiss) private var dismiss

    func makeCoordinator() -> Coordinator {
        Coordinator(dismiss: dismiss, onImage: onImage)
    }

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = source.pickerSourceType
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_: UIImagePickerController, context _: Context) {}

    final class Coordinator: NSObject, UINavigationControllerDelegate, UIImagePickerControllerDelegate {
        let dismiss: DismissAction
        let onImage: (UIImage) -> Void

        init(dismiss: DismissAction, onImage: @escaping (UIImage) -> Void) {
            self.dismiss = dismiss
            self.onImage = onImage
        }

        func imagePickerController(
            _: UIImagePickerController,
            didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]
        ) {
            if let image = info[.originalImage] as? UIImage {
                onImage(image)
            }
            dismiss()
        }

        func imagePickerControllerDidCancel(_: UIImagePickerController) {
            dismiss()
        }
    }
}

struct AttachmentPreviewSheet: View {
    let attachment: CaptureAttachment
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(spacing: 18) {
            HStack {
                Text(attachment.label)
                    .font(.system(size: 22, weight: .heavy, design: .rounded))
                    .foregroundStyle(Color.textPrimary)

                Spacer()

                Button {
                    dismiss()
                } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(Color.textPrimary)
                        .frame(width: 34, height: 34)
                        .background(Color.surfacePrimary, in: Circle())
                }
                .buttonStyle(.plain)
            }

            if let image = attachment.previewImage {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFit()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                VStack(spacing: 12) {
                    Image(systemName: attachment.kind.icon)
                        .font(.system(size: 42, weight: .semibold))
                    Text(attachment.mimeType)
                        .font(.system(size: 14, weight: .semibold, design: .rounded))
                }
                .foregroundStyle(Color.textSecondary)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .padding(22)
        .background(Color.appBackground.ignoresSafeArea())
        .preferredColorScheme(.dark)
    }
}

struct DrawingSheet: View {
    let onDone: (PKDrawing) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var drawing: PKDrawing

    init(initialDrawing: PKDrawing = PKDrawing(), onDone: @escaping (PKDrawing) -> Void) {
        self.onDone = onDone
        _drawing = State(initialValue: initialDrawing)
    }

    var body: some View {
        ZStack(alignment: .top) {
            Color.appBackground.ignoresSafeArea()

            PencilCanvas(drawing: $drawing)
                .ignoresSafeArea()

            HStack {
                Button {
                    dismiss()
                } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(Color.textPrimary)
                        .frame(width: 40, height: 40)
                        .background(Color.appBackground.opacity(0.92), in: Circle())
                }
                .buttonStyle(.plain)

                Spacer()

                Button {
                    guard !drawing.bounds.isEmpty else {
                        dismiss()
                        return
                    }
                    onDone(drawing)
                    dismiss()
                } label: {
                    Text("Done")
                        .font(.system(size: 16, weight: .bold, design: .rounded))
                        .foregroundStyle(Color.textPrimary)
                        .padding(.horizontal, 18)
                        .frame(height: 40)
                        .background(Color.appBackground.opacity(0.92), in: Capsule())
                }
                .buttonStyle(.plain)
                .disabled(drawing.bounds.isEmpty)
                .opacity(drawing.bounds.isEmpty ? 0.45 : 1)
            }
            .padding(.horizontal, 22)
            .padding(.top, 18)
        }
    }
}

struct PencilCanvas: UIViewRepresentable {
    @Binding var drawing: PKDrawing

    func makeCoordinator() -> Coordinator {
        Coordinator(drawing: $drawing)
    }

    func makeUIView(context: Context) -> PKCanvasView {
        let canvas = PKCanvasView()
        canvas.backgroundColor = .clear
        canvas.isOpaque = false
        canvas.drawingPolicy = .anyInput
        canvas.overrideUserInterfaceStyle = .dark
        canvas.tool = PKInkingTool(.pen, color: .white, width: 5)
        canvas.delegate = context.coordinator
        context.coordinator.canvas = canvas

        DispatchQueue.main.async {
            context.coordinator.showToolPicker()
        }

        return canvas
    }

    func updateUIView(_ uiView: PKCanvasView, context _: Context) {
        if uiView.drawing.dataRepresentation() != drawing.dataRepresentation() {
            uiView.drawing = drawing
        }
    }

    static func dismantleUIView(_ uiView: PKCanvasView, coordinator: Coordinator) {
        coordinator.toolPicker.removeObserver(uiView)
    }

    final class Coordinator: NSObject, PKCanvasViewDelegate {
        @Binding var drawing: PKDrawing
        weak var canvas: PKCanvasView?
        let toolPicker = PKToolPicker()

        init(drawing: Binding<PKDrawing>) {
            _drawing = drawing
        }

        func showToolPicker() {
            guard let canvas else { return }
            toolPicker.addObserver(canvas)
            toolPicker.setVisible(true, forFirstResponder: canvas)
            canvas.becomeFirstResponder()
        }

        func canvasViewDrawingDidChange(_ canvasView: PKCanvasView) {
            drawing = canvasView.drawing
        }
    }
}

struct VoiceRecorderSheet: View {
    let onDone: (URL) -> Void
    @Environment(\.dismiss) private var dismiss
    @StateObject private var recorder = VoiceRecorder()

    var body: some View {
        VStack(spacing: 20) {
            Capsule()
                .fill(Color.textSecondary.opacity(0.32))
                .frame(width: 42, height: 5)
                .padding(.top, 6)

            Text("Voice Recording")
                .font(.system(size: 24, weight: .heavy, design: .rounded))
                .foregroundStyle(Color.textPrimary)

            Text(recorder.elapsedText)
                .font(.system(size: 42, weight: .heavy, design: .rounded))
                .foregroundStyle(recorder.isRecording ? Color.feedbackCritical : Color.textPrimary)
                .monospacedDigit()

            if !recorder.errorMessage.isEmpty {
                Text(recorder.errorMessage)
                    .font(.system(size: 13, weight: .semibold, design: .rounded))
                    .foregroundStyle(Color.feedbackCritical)
            }

            HStack(spacing: 14) {
                Button {
                    recorder.toggleRecording()
                } label: {
                    Label(recorder.isRecording ? "Stop" : "Record", systemImage: recorder.isRecording ? "stop.fill" : "mic.fill")
                        .font(.system(size: 16, weight: .bold, design: .rounded))
                        .foregroundStyle(Color.textPrimary)
                        .frame(maxWidth: .infinity)
                        .frame(height: 48)
                        .background(Color.surfaceRaised, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                }
                .buttonStyle(.plain)

                Button {
                    if let url = recorder.finish() {
                        onDone(url)
                    }
                    dismiss()
                } label: {
                    Text("Done")
                        .font(.system(size: 16, weight: .bold, design: .rounded))
                        .foregroundStyle(Color.textPrimary)
                        .frame(maxWidth: .infinity)
                        .frame(height: 48)
                        .background(Color.accentInsight, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                }
                .buttonStyle(.plain)
                .disabled(recorder.recordingURL == nil && !recorder.isRecording)
                .opacity(recorder.recordingURL == nil && !recorder.isRecording ? 0.45 : 1)
            }
        }
        .padding(22)
        .background(Color.appBackground.ignoresSafeArea())
        .preferredColorScheme(.dark)
        .onDisappear { recorder.cancel() }
    }
}

final class VoiceRecorder: NSObject, ObservableObject {
    @Published var elapsed: TimeInterval = 0
    @Published var errorMessage = ""
    @Published var isRecording = false
    @Published var recordingURL: URL?
    private var recorder: AVAudioRecorder?
    private var startedAt: Date?
    private var timer: Timer?

    var elapsedText: String {
        let total = Int(elapsed.rounded(.down))
        return String(format: "%02d:%02d", total / 60, total % 60)
    }

    func toggleRecording() {
        isRecording ? stopRecording() : startRecording()
    }

    func finish() -> URL? {
        if isRecording {
            stopRecording()
        }
        return recordingURL
    }

    func cancel() {
        if isRecording {
            recorder?.stop()
        }
        timer?.invalidate()
        if let recordingURL {
            try? FileManager.default.removeItem(at: recordingURL)
        }
    }

    private func startRecording() {
        AVAudioApplication.requestRecordPermission { [weak self] granted in
            DispatchQueue.main.async {
                guard let self else { return }
                guard granted else {
                    self.errorMessage = "Microphone access is required to record."
                    return
                }
                self.beginRecording()
            }
        }
    }

    private func beginRecording() {
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker])
            try session.setActive(true)

            let url = FileManager.default.temporaryDirectory
                .appendingPathComponent("nudge-voice-\(UUID().uuidString).m4a")
            recorder = try AVAudioRecorder(
                url: url,
                settings: [
                    AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
                    AVNumberOfChannelsKey: 1,
                    AVSampleRateKey: 44_100,
                    AVEncoderBitRateKey: 64_000
                ]
            )
            recorder?.record()
            recordingURL = url
            startedAt = Date()
            elapsed = 0
            errorMessage = ""
            isRecording = true
            startTimer()
        } catch {
            errorMessage = "Could not start recording."
        }
    }

    private func stopRecording() {
        recorder?.stop()
        timer?.invalidate()
        timer = nil
        isRecording = false
        try? AVAudioSession.sharedInstance().setActive(false)
    }

    private func startTimer() {
        timer?.invalidate()
        let timer = Timer(timeInterval: 0.2, repeats: true) { [weak self] _ in
            self?.tick()
        }
        self.timer = timer
        RunLoop.main.add(timer, forMode: .common)
    }

    private func tick() {
        guard let startedAt else { return }
        elapsed = Date().timeIntervalSince(startedAt)
        if elapsed >= 60 {
            stopRecording()
        }
    }
}

extension UIImage {
    func nudgeScaled(maxDimension: CGFloat) -> UIImage {
        let largestSide = max(size.width, size.height)
        guard largestSide > maxDimension else { return self }

        let scale = maxDimension / largestSide
        let targetSize = CGSize(
            width: floor(size.width * scale),
            height: floor(size.height * scale)
        )

        return UIGraphicsImageRenderer(size: targetSize).image { _ in
            draw(in: CGRect(origin: .zero, size: targetSize))
        }
    }

    func nudgePreparedForUpload(maxDimension: CGFloat) -> UIImage {
        nudgeWithWhiteBackground().nudgeScaled(maxDimension: maxDimension)
    }

    func nudgeWithWhiteBackground() -> UIImage {
        UIGraphicsImageRenderer(size: size).image { context in
            UIColor.white.setFill()
            context.fill(CGRect(origin: .zero, size: size))
            draw(in: CGRect(origin: .zero, size: size))
        }
    }
}
