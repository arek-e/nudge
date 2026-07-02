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
