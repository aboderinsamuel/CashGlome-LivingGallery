import SwiftUI
import SwiftData

struct SettingsView: View {
    @Environment(\.modelContext) private var context
    @EnvironmentObject private var settings: AppSettings
    @Query private var entries: [Entry]
    @State private var keyDraft = ""
    @State private var testing = false
    @State private var testResult: String?
    @State private var confirmErase = false
    @State private var exportURL: URL?

    var body: some View {
        Form {
            Section("You") {
                TextField("Your name", text: $settings.name)
                Picker("Currency", selection: $settings.currency) {
                    ForEach(Money.currencies, id: \.code) { c in Text("\(c.flag) \(c.name)").tag(c.code) }
                }
            }

            Section {
                Toggle("Use Meta Muse", isOn: $settings.museOn)
                if settings.hasKey {
                    LabeledContent("Meta key", value: "Saved in Keychain")
                    Button("Remove key", role: .destructive) { settings.museKey = ""; testResult = nil }
                } else {
                    SecureField("Paste your Meta key", text: $keyDraft)
                        .textInputAutocapitalization(.never).autocorrectionDisabled()
                    Button("Save key") { settings.museKey = keyDraft; keyDraft = ""; Haptics.success() }
                        .disabled(keyDraft.trimmingCharacters(in: .whitespaces).count < 8)
                }
                if settings.hasKey {
                    Button {
                        testing = true; testResult = nil
                        Task {
                            do { testResult = "Connected: " + (try await Muse.test()) } catch { testResult = error.localizedDescription }
                            testing = false
                        }
                    } label: { HStack { Text("Test connection"); Spacer(); if testing { ProgressView() } } }
                    if let testResult { Text(testResult).font(.footnote).foregroundStyle(Theme.ink2) }
                }
                Toggle("Answer questions with Muse", isOn: Binding(get: { settings.askMuse == true }, set: { settings.askMuse = $0 }))
                Picker("Reading entries", selection: $settings.parseModel) {
                    ForEach(AppSettings.models, id: \.id) { m in Text(m.name).tag(m.id) }
                }
                Picker("Answering questions", selection: $settings.askModel) {
                    ForEach(AppSettings.models, id: \.id) { m in Text(m.name).tag(m.id) }
                }
            } header: {
                Text("Meta Muse")
            } footer: {
                Text("With Muse on, what you write is read by Meta Muse, and questions are answered from searches of your entries. The key stays in this phone's Keychain and is never exported. Photos are never sent. With Muse off, everything is read and counted on this phone.")
            }

            Section("Feel") {
                Toggle("Haptics", isOn: $settings.haptics)
            }

            Section {
                if entries.isEmpty {
                    Button("Try an example month") { Demo.fill(context, currency: settings.currency); Haptics.success() }
                }
                if let exportURL {
                    ShareLink(item: exportURL) { Label("Share export", systemImage: "square.and.arrow.up") }
                } else {
                    Button { exportURL = makeExport() } label: { Label("Export my entries (JSON)", systemImage: "doc.badge.arrow.up") }
                        .disabled(entries.isEmpty)
                }
                Button("Erase everything", role: .destructive) { confirmErase = true }
                    .disabled(entries.isEmpty)
            } header: {
                Text("Your data")
            } footer: {
                Text("\(entries.count) entries, kept only on this phone. Exports never include your Meta key.")
            }

            Section("About") {
                LabeledContent("Version", value: Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0")
                Text("CashGlome shows what you've written down. It isn't financial advice.")
                Text("Paintings are public-domain works from Wikimedia Commons.").foregroundStyle(Theme.ink3)
            }
        }
        .scrollContentBackground(.hidden)
        .background(Theme.canvas.ignoresSafeArea())
        .navigationTitle("Settings")
        .confirmationDialog("Erase all \(entries.count) entries? This can't be undone.", isPresented: $confirmErase, titleVisibility: .visible) {
            Button("Erase everything", role: .destructive) {
                for e in entries { context.delete(e) }
                try? context.save()
                exportURL = nil
                Haptics.warning()
            }
        }
    }

    private func makeExport() -> URL? {
        let list: [[String: Any]] = entries.sorted { $0.day < $1.day }.map { e in
            var d: [String: Any] = ["id": e.id.uuidString, "text": e.text, "label": e.label, "amount": e.amount, "dir": e.directionRaw,
                                    "category": e.category, "date": e.day, "createdAt": Int(e.createdAt.timeIntervalSince1970 * 1000), "source": e.source]
            if let f = e.feelingRaw { d["feeling"] = f }
            return d
        }
        let body: [String: Any] = ["app": "CashGlome", "version": 1, "exportedAt": ISO8601DateFormatter().string(from: .now),
                                   "profile": ["name": settings.name, "currency": settings.currency], "entries": list]
        guard let data = try? JSONSerialization.data(withJSONObject: body, options: [.prettyPrinted, .sortedKeys]) else { return nil }
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("CashGlome-\(Day.today).json")
        try? data.write(to: url)
        return url
    }
}
