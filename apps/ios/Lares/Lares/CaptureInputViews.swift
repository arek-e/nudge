import SwiftUI

struct LaresLogo: View {
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

            Text("Lares")
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(Color.textPrimary)
        }
    }
}

struct CaptureCanvas: View {
    @ObservedObject var model: LaresCaptureViewModel
    var focused: FocusState<Bool>.Binding

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            ZStack(alignment: .topLeading) {
                TextField("What matters now?", text: $model.draft, axis: .vertical)
                    .focused(focused)
                    .submitLabel(.done)
                    .onSubmit { Task { await model.submit() } }
                    .lineLimit(1...5)
                    .textInputAutocapitalization(.sentences)
                    .autocorrectionDisabled(false)
                    .font(.system(size: 25, weight: .semibold, design: .rounded))
                    .foregroundStyle(model.stage.isWorking && model.hasDraft ? Color.clear : Color.textPrimary)
                    .fixedSize(horizontal: false, vertical: true)

                if model.stage.isWorking && model.hasDraft {
                    ShimmeringNoteText(text: model.draft)
                        .allowsHitTesting(false)
                }
            }

            HStack {
                Spacer(minLength: 0)
                StatusChip(stage: model.stage, result: model.latestResult)
            }
            .frame(minHeight: 22)

            if !model.errorMessage.isEmpty {
                Text(model.errorMessage)
                    .font(.system(size: 13, weight: .medium, design: .rounded))
                    .foregroundStyle(Color.feedbackCritical)
                    .padding(.horizontal, 2)
            }
        }
        .frame(maxWidth: .infinity, alignment: .topLeading)
    }
}

struct StatusChip: View {
    let stage: CaptureStage
    let result: CaptureResult?

    var body: some View {
        Group {
            if let label = stage.label {
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
            } else if let result {
                Text("\(result.signalCount) signal")
                    .font(.system(size: 16, weight: .semibold, design: .rounded))
                    .foregroundStyle(Color.textSecondary)
            }
        }
        .lineLimit(1)
        .fixedSize(horizontal: true, vertical: false)
    }
}

struct ShimmeringStatusText: View {
    let text: String

    var body: some View {
        LaresShimmeringText(
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
        LaresShimmeringText(
            text: text,
            font: .system(size: 25, weight: .semibold, design: .rounded),
            textColor: Color.textPrimary,
            highlightColor: Color.shimmerStrong,
            maxLines: 5,
            duration: 1.35
        )
    }
}

struct LaresShimmeringText: View {
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
    let latestResult: CaptureResult?
    let saving: Bool
    let focusInput: () -> Void
    let addLine: () -> Void
    let submit: () -> Void

    var body: some View {
        HStack(spacing: 14) {
            if let latestResult {
                ResultMetricRail(result: latestResult)
            } else {
                Button(action: hasDraft ? submit : focusInput) {
                    HStack(spacing: 8) {
                        Image(systemName: hasDraft ? "checkmark" : "sparkle.magnifyingglass")
                            .foregroundStyle(Color.accentSuccess)
                        Text(hasDraft ? "Submit note" : "Log what matters")
                            .foregroundStyle(Color.textPrimary)
                            .lineLimit(1)
                            .minimumScaleFactor(0.72)
                    }
                    .font(.system(size: 16, weight: .semibold, design: .rounded))
                    .frame(minWidth: 186, minHeight: 48)
                    .background(Color.surfaceRaised.opacity(0.96), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(Color.borderSubtle, lineWidth: 1))
                    .shadow(color: .shadowAmbient, radius: 14, y: 10)
                }
                .buttonStyle(.plain)

                Spacer(minLength: 0)

                RailButton(systemName: "mic.fill", color: .accentPrimary, action: focusInput)
                RailButton(systemName: "plus", color: .accentStreak, action: addLine)
                if hasDraft || saving {
                    RailButton(systemName: saving ? "hourglass" : "checkmark", color: .textPrimary, action: submit)
                        .transition(.scale(scale: 0.82).combined(with: .opacity))
                }
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
