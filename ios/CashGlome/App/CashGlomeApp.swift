import SwiftUI
import SwiftData

@main
struct CashGlomeApp: App {
    @StateObject private var settings = AppSettings.shared
    @StateObject private var model = AppModel()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(settings)
                .environmentObject(model)
                .tint(Theme.gold)
        }
        // Everything lives in a database on this phone. No account, no bank connection, no cloud.
        .modelContainer(for: [Entry.self, Goal.self])
    }
}

enum AppTab: Hashable { case month, ledger, ask, settings }

/// What the tabs share: which tab is open, and a question handed from the composer to Ask.
@MainActor
final class AppModel: ObservableObject {
    @Published var tab: AppTab = .month
    @Published var pendingQuestion: String?
    @Published var month: String = Day.thisMonth
    /// The last thing added, for Undo.
    @Published var lastAdded: [UUID] = []
    @Published var toast: String?

    func ask(_ q: String) {
        pendingQuestion = q
        tab = .ask
    }
}

struct RootView: View {
    @EnvironmentObject private var settings: AppSettings
    @EnvironmentObject private var model: AppModel

    var body: some View {
        Group {
            if settings.onboarded {
                TabView(selection: $model.tab) {
                    Tab("Month", systemImage: "paintpalette.fill", value: AppTab.month) {
                        NavigationStack { MonthView() }
                    }
                    Tab("Ledger", systemImage: "list.bullet.rectangle.portrait.fill", value: AppTab.ledger) {
                        NavigationStack { LedgerView() }
                    }
                    Tab("Ask", systemImage: "sparkles", value: AppTab.ask) {
                        NavigationStack { AskView() }
                    }
                    Tab("Settings", systemImage: "gearshape.fill", value: AppTab.settings) {
                        NavigationStack { SettingsView() }
                    }
                }
                .onChange(of: model.tab) { _, _ in Haptics.select() }
                .transition(.opacity)
            } else {
                OnboardingView()
                    .transition(.opacity)
            }
        }
        .animation(.easeInOut(duration: 0.35), value: settings.onboarded)
    }
}
