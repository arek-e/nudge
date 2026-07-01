import SwiftUI

struct TopChrome: View {
    let dailyStreak: Int
    let perform: (LaresChromeAction) -> Void

    var body: some View {
        HStack(alignment: .center) {
            LaresLogo()
                .frame(width: 104, alignment: .leading)

            Spacer()

            Button {
                perform(.todayCalendar)
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: "calendar")
                        .foregroundStyle(Color.accentPrimary)
                    Text("Today")
                }
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(Color.textPrimary)
                .padding(.horizontal, 14)
                .frame(height: 38)
                .background(Color.surfacePrimary.opacity(0.94), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(Color.borderSubtle, lineWidth: 1))
                .shadow(color: .shadowAmbient, radius: 12, y: 8)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Open calendar")

            Spacer()

            Button {
                perform(.streakCalendar)
            } label: {
                HStack(spacing: 9) {
                    Image(systemName: "flame.fill")
                        .foregroundStyle(Color.accentStreak)
                    Text(dailyStreak > 0 ? "\(dailyStreak) day" : "Start")
                        .lineLimit(1)
                        .minimumScaleFactor(0.72)
                }
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(Color.textPrimary)
                .padding(.horizontal, 13)
                .frame(height: 38)
                .background(Color.surfacePrimary.opacity(0.94), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(Color.borderSubtle, lineWidth: 1))
                .shadow(color: .shadowAmbient, radius: 12, y: 8)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Open streak calendar")
        }
    }
}
