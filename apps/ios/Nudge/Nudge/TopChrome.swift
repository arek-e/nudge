import SwiftUI

struct TopChrome: View {
    let dailyStreak: Int
    let signal: ChromeSignal?
    let perform: (NudgeChromeAction) -> Void

    var body: some View {
        ZStack {
            HStack(alignment: .center, spacing: 10) {
                if let signal {
                    signalButton(signal)
                }
                reviewButton

                Spacer(minLength: 12)

                streakButton
            }

            todayButton
        }
        .frame(maxWidth: .infinity)
    }

    private var todayButton: some View {
        Button {
            perform(.todayCalendar)
        } label: {
            HStack(spacing: 8) {
                Image(systemName: "calendar")
                    .foregroundStyle(Color.accentPrimary)
                Text("Today")
            }
            .font(.system(size: 14, weight: .semibold))
            .foregroundStyle(Color.textPrimary)
            .padding(.horizontal, 15)
            .frame(height: 38)
            .background(chromeButtonBackground)
            .shadow(color: .shadowAmbient, radius: 12, y: 8)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Open today's calendar")
    }

    private var reviewButton: some View {
        Button {
            perform(.dailyReview)
        } label: {
            Image(systemName: "checklist.checked")
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(Color.accentSuccess)
                .frame(width: 38, height: 38)
                .background(chromeButtonBackground)
                .shadow(color: .shadowAmbient, radius: 12, y: 8)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Open daily review")
    }

    private var streakButton: some View {
        Button {
            perform(.settings)
        } label: {
            HStack(spacing: 8) {
                Image(systemName: "flame.fill")
                    .foregroundStyle(Color.accentStreak)
                Text(dailyStreak > 0 ? "\(dailyStreak) day" : "Start")
                    .lineLimit(1)
                    .minimumScaleFactor(0.72)
                Image(systemName: "gearshape")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Color.textSecondary)
            }
            .font(.system(size: 14, weight: .medium))
            .foregroundStyle(Color.textPrimary)
            .padding(.horizontal, 12)
            .frame(height: 38)
            .background(chromeButtonBackground)
            .shadow(color: .shadowAmbient, radius: 12, y: 8)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Open streak settings")
    }

    private func signalButton(_ signal: ChromeSignal) -> some View {
        Button {
            perform(.statusSignal)
        } label: {
            ShimmeringChromeSignalIcon(
                color: signalColor(signal),
                isActive: signal.usesShimmer,
                systemName: signal.systemImageName
            )
            .frame(width: 38, height: 38)
            .background(chromeButtonBackground)
            .shadow(color: .shadowAmbient, radius: 12, y: 8)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(signal.accessibilityLabel)
    }

    private var chromeButtonBackground: some View {
        RoundedRectangle(cornerRadius: 12, style: .continuous)
            .fill(Color.surfacePrimary.opacity(0.94))
            .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(Color.borderSubtle, lineWidth: 1))
    }

    private func signalColor(_ signal: ChromeSignal) -> Color {
        switch signal.tone {
        case .critical:
            Color.feedbackCritical
        case .degraded:
            Color.accentPrimary
        }
    }
}

struct SyncStatusMatrixView: View {
    let snapshot: SyncStatusMatrixSnapshot

    var body: some View {
        VStack(spacing: 8) {
            SyncStatusRow(label: "Sync", item: snapshot.global)
            HStack(spacing: 8) {
                SyncStatusRow(label: "Note", item: snapshot.note)
                SyncStatusRow(label: "AI", item: snapshot.ai)
            }
        }
        .frame(maxWidth: 430)
        .accessibilityElement(children: .contain)
    }
}

private struct SyncStatusRow: View {
    let label: String
    let item: SyncStatusItem

    var body: some View {
        HStack(spacing: 9) {
            Image(systemName: item.systemImageName)
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(tint)
                .frame(width: 24, height: 24)
                .background(tint.opacity(0.14), in: Circle())

            VStack(alignment: .leading, spacing: 1) {
                Text(label)
                    .font(.system(size: 10, weight: .bold, design: .rounded))
                    .foregroundStyle(Color.textSecondary)
                    .textCase(.uppercase)
                Text(item.title)
                    .font(.system(size: 13, weight: .semibold, design: .rounded))
                    .foregroundStyle(Color.textPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.72)
            }

            Spacer(minLength: 0)
        }
        .padding(.horizontal, 10)
        .frame(height: 46)
        .background(Color.surfacePrimary.opacity(0.72), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(Color.borderSubtle.opacity(0.78), lineWidth: 1)
        )
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(label): \(item.title). \(item.detail)")
    }

    private var tint: Color {
        switch item.tone {
        case .critical:
            Color.feedbackCritical
        case .neutral:
            Color.textSecondary
        case .positive:
            Color.accentSuccess
        case .working:
            Color.accentInsight
        }
    }
}

private struct ShimmeringChromeSignalIcon: View {
    let color: Color
    let isActive: Bool
    let systemName: String

    var body: some View {
        TimelineView(.animation) { context in
            let duration: TimeInterval = 1.45
            let phase = context.date.timeIntervalSinceReferenceDate
                .truncatingRemainder(dividingBy: duration) / duration

            Image(systemName: systemName)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(color)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .overlay {
                    if isActive {
                        GeometryReader { geometry in
                            shimmer(in: geometry, phase: phase)
                        }
                        .mask(iconMask)
                        .blendMode(.plusLighter)
                    }
                }
        }
    }

    private var iconMask: some View {
        Image(systemName: systemName)
            .font(.system(size: 15, weight: .semibold))
            .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func shimmer(in geometry: GeometryProxy, phase: Double) -> some View {
        let bandWidth = max(geometry.size.width * 0.72, 24)

        return LinearGradient(
            colors: [.clear, Color.white.opacity(0.5), .clear],
            startPoint: .leading,
            endPoint: .trailing
        )
        .frame(width: bandWidth, height: geometry.size.height)
        .offset(x: -bandWidth + phase * (geometry.size.width + bandWidth))
    }
}
