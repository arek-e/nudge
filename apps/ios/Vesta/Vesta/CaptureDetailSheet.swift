import SwiftUI

struct CaptureDetailSheet: View {
    let result: CaptureResult
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ScrollView(showsIndicators: false) {
            VStack(alignment: .leading, spacing: 18) {
                Capsule()
                    .fill(Color.textSecondary.opacity(0.32))
                    .frame(width: 42, height: 5)
                    .frame(maxWidth: .infinity)
                    .padding(.top, 8)

                HStack(alignment: .center) {
                    Text("Capture saved")
                        .font(.system(size: 18, weight: .bold, design: .rounded))
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

                Text(result.title)
                    .font(.system(size: 25, weight: .heavy, design: .rounded))
                    .foregroundStyle(Color.textPrimary)
                    .lineLimit(3)
                    .fixedSize(horizontal: false, vertical: true)

                CaptureHeroCard(result: result)

                SheetSectionTitle("Items")

                VStack(spacing: 10) {
                    ForEach(result.items) { item in
                        DetailItemRow(item: item)
                    }
                }

                SheetSectionTitle("Context")

                ContextSummaryCard(result: result)

                SheetSectionTitle("References")

                ReferenceRow(result: result)
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 32)
        }
        .background(Color.appBackground.ignoresSafeArea())
        .preferredColorScheme(.dark)
    }
}

struct CaptureHeroCard: View {
    let result: CaptureResult

    var body: some View {
        VStack(spacing: 18) {
            HStack(alignment: .firstTextBaseline, spacing: 10) {
                Image(systemName: "checkmark.seal.fill")
                    .font(.system(size: 26, weight: .bold))
                    .foregroundStyle(Color.accentSuccess)
                Text("Saved")
                    .font(.system(size: 40, weight: .heavy, design: .rounded))
                    .foregroundStyle(Color.textPrimary)
                Text("for Vesta")
                    .font(.system(size: 16, weight: .semibold, design: .rounded))
                    .foregroundStyle(Color.textSecondary)
            }

            HStack(spacing: 0) {
                HeroMetric(value: "\(result.signalCount)", label: "Signals", color: .accentSignal)
                HeroMetric(value: "\(result.actionCount)", label: "Open actions", color: .accentInsight)
                HeroMetric(value: "\(result.sourceCount)", label: "References", color: .accentReference)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(20)
        .background(Color.surfacePrimary.opacity(0.94), in: RoundedRectangle(cornerRadius: 24, style: .continuous))
        .shadow(color: .shadowAmbient.opacity(0.65), radius: 24, y: 10)
    }
}

struct HeroMetric: View {
    let value: String
    let label: String
    let color: Color

    var body: some View {
        VStack(spacing: 6) {
            Text(value)
                .font(.system(size: 17, weight: .bold, design: .rounded))
                .foregroundStyle(Color.textPrimary)
            HStack(spacing: 5) {
                Circle()
                    .fill(color)
                    .frame(width: 6, height: 6)
                Text(label)
                    .font(.system(size: 12, weight: .semibold, design: .rounded))
                    .foregroundStyle(Color.textSecondary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.82)
            }
        }
        .frame(maxWidth: .infinity)
    }
}

struct SheetSectionTitle: View {
    let title: String

    init(_ title: String) {
        self.title = title
    }

    var body: some View {
        Text(title)
            .font(.system(size: 17, weight: .bold, design: .rounded))
            .foregroundStyle(Color.textSecondary)
            .padding(.top, 4)
    }
}

struct DetailItemRow: View {
    let item: CaptureDetailItem

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: item.icon)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(item.color)
                .frame(width: 34, height: 34)
                .background(item.color.opacity(0.12), in: Circle())

            VStack(alignment: .leading, spacing: 3) {
                Text(item.title)
                    .font(.system(size: 16, weight: .semibold, design: .rounded))
                    .foregroundStyle(Color.textPrimary)
                Text(item.subtitle)
                    .font(.system(size: 12, weight: .medium, design: .rounded))
                    .foregroundStyle(Color.textSecondary)
                    .lineLimit(2)
            }

            Spacer(minLength: 8)

            Text(item.value)
                .font(.system(size: 15, weight: .bold, design: .rounded))
                .foregroundStyle(Color.textPrimary)
                .lineLimit(1)
                .minimumScaleFactor(0.72)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(Color.surfacePrimary.opacity(0.94), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .shadow(color: .shadowAmbient.opacity(0.45), radius: 16, y: 7)
    }
}

struct ContextSummaryCard: View {
    let result: CaptureResult

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(result.summary)
                .font(.system(size: 16, weight: .medium, design: .rounded))
                .foregroundStyle(Color.textPrimary)
                .lineSpacing(3)
        }
        .padding(18)
        .background(Color.surfacePrimary.opacity(0.94), in: RoundedRectangle(cornerRadius: 22, style: .continuous))
        .shadow(color: .shadowAmbient.opacity(0.45), radius: 18, y: 8)
    }
}

struct ReferenceRow: View {
    let result: CaptureResult

    var body: some View {
        HStack(spacing: 8) {
            ForEach(result.references, id: \.self) { reference in
                Text(reference)
                    .font(.system(size: 13, weight: .semibold, design: .rounded))
                    .foregroundStyle(Color.textPrimary)
                    .padding(.horizontal, 12)
                    .frame(height: 34)
                    .background(Color.surfaceRaised.opacity(0.92), in: Capsule())
            }

            Spacer(minLength: 0)

            Text("\(result.sourceCount) sources")
                .font(.system(size: 13, weight: .bold, design: .rounded))
                .foregroundStyle(Color.accentInsight)
        }
    }
}
