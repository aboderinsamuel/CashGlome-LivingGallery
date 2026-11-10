import SwiftUI
import SwiftData

/// Three quiet pages: what this is, your name and currency, then begin (or look around with an example month).
/// No account, no bank login, nothing to sign.
struct OnboardingView: View {
    @Environment(\.modelContext) private var context
    @EnvironmentObject private var settings: AppSettings
    @State private var page = 0
    @State private var name = ""
    @State private var currency = AppSettings.shared.currency

    var body: some View {
        ZStack {
            Paintings.all[page == 0 ? "hunters" : page == 1 ? "moneylender" : "harvesters"]!.image
                .resizable().aspectRatio(contentMode: .fill)
                .ignoresSafeArea()
                .overlay(LinearGradient(colors: [.black.opacity(0.1), .black.opacity(0.35), Theme.canvas.opacity(0.92), Theme.canvas], startPoint: .top, endPoint: .bottom).ignoresSafeArea())
                .id(page)
                .transition(.opacity)

            VStack(alignment: .leading, spacing: 0) {
                Spacer()
                Group {
                    switch page {
                    case 0: intro
                    case 1: about
                    default: begin
                    }
                }
                .transition(.asymmetric(insertion: .move(edge: .trailing).combined(with: .opacity), removal: .move(edge: .leading).combined(with: .opacity)))
                .id(page)

                HStack(spacing: 6) {
                    ForEach(0..<3) { i in
                        Capsule().fill(i == page ? Theme.gold : Theme.ink3.opacity(0.4)).frame(width: i == page ? 22 : 7, height: 7)
                    }
                }
                .padding(.vertical, 22)
                .animation(Theme.spring, value: page)
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 12)
        }
        .animation(.easeInOut(duration: 0.45), value: page)
        .preferredColorScheme(.dark)
    }

    private var intro: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("CashGlome").eyebrow()
            Text("Your money,\npainted.").font(Theme.display(52)).foregroundStyle(Theme.ink)
            Text("Write what you spend the way you'd text a friend. Each month becomes a chapter with its own painting, and you can ask it anything.")
                .font(.system(size: 17)).foregroundStyle(Theme.ink2)
            Button("Begin") { next() }.buttonStyle(PrimaryButtonStyle()).padding(.top, 10)
        }
    }

    private var about: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("First, the basics").font(Theme.display(34))
            VStack(spacing: 0) {
                TextField("What should we call you?", text: $name)
                    .textContentType(.givenName).submitLabel(.next)
                    .padding(16)
                Divider().overlay(Theme.hairline)
                Picker("Currency", selection: $currency) {
                    ForEach(Money.currencies, id: \.code) { c in Text("\(c.flag) \(c.name)").tag(c.code) }
                }
                .padding(.horizontal, 8).padding(.vertical, 6)
            }
            .glass(in: RoundedRectangle(cornerRadius: 20, style: .continuous))
            Label("No account and no bank login. Everything stays on this phone.", systemImage: "lock.fill")
                .font(.system(size: 14)).foregroundStyle(Theme.ink2)
            Button("Continue") { settings.name = name.trimmingCharacters(in: .whitespaces); settings.currency = currency; next() }
                .buttonStyle(PrimaryButtonStyle())
        }
    }

    private var begin: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Three ways in").font(Theme.display(34))
            row("text.bubble.fill", "Write it", "“bolt 6k, lunch 4.5k, got paid 350k”: several at once.")
            row("mic.fill", "Say it", "Tap the mic on the keyboard and talk.")
            row("sparkles", "Ask it", "“Where did my money go this month?” Answers come from your own entries.")
            Button("Start writing") { finish(demo: false) }.buttonStyle(PrimaryButtonStyle()).padding(.top, 8)
            Button("Look around with an example month") { finish(demo: true) }
                .font(.system(size: 15, weight: .medium)).frame(maxWidth: .infinity).padding(.vertical, 10)
                .foregroundStyle(Theme.ink2)
        }
    }

    private func row(_ symbol: String, _ title: String, _ text: String) -> some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: symbol).font(.system(size: 18, weight: .semibold)).foregroundStyle(Theme.gold).frame(width: 28)
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.system(size: 17, weight: .semibold))
                Text(text).font(.system(size: 15)).foregroundStyle(Theme.ink2)
            }
        }
    }

    private func next() { Haptics.tap(); page += 1 }

    private func finish(demo: Bool) {
        if demo { Demo.fill(context, currency: settings.currency) }
        Haptics.success()
        settings.onboarded = true
    }
}
