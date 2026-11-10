import SwiftUI
import SwiftData

/// One line at the bottom of the screen: "bolt 6k, lunch 4.5k, mum sent 20k". It reads as you type, shows what it
/// understood, and adds everything with one tap. A question ("how much on food?") goes to Ask instead.
/// Tap the keyboard's mic to say it.
struct ComposerBar: View {
    @Environment(\.modelContext) private var context
    @EnvironmentObject private var settings: AppSettings
    @EnvironmentObject private var model: AppModel
    @Query(sort: \Entry.day, order: .reverse) private var entries: [Entry]

    @State private var text = ""
    @State private var busy = false
    @State private var overrides: [Int: String] = [:]   // index → category picked here
    @State private var flipped: Set<Int> = []           // indexes whose direction was flipped here
    @FocusState private var focused: Bool

    private var question: Bool { Oracle.isQuestion(text) }
    private var preview: [Parsed] {
        guard !question else { return [] }
        return Oracle.parse(text).map(Learned.recall).enumerated().map { i, p in apply(i, p) }
    }
    private var usuals: [Entry] { Insights.usuals(entries) }

    private func apply(_ i: Int, _ p: Parsed) -> Parsed {
        var q = p
        if flipped.contains(i) {
            q.direction = p.direction == .moneyIn ? .moneyOut : .moneyIn
            q.category = q.direction == .moneyIn ? "windfall" : "other"
        }
        if let c = overrides[i] { q.category = c }
        return q
    }

    var body: some View {
        VStack(spacing: 10) {
            if let toast = model.toast {
                ToastView(text: toast, undo: model.lastAdded.isEmpty ? nil : undo)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
            if question {
                Button { send() } label: {
                    Label("A question. Tap to get the answer", systemImage: "sparkles")
                        .font(.system(size: 14, weight: .medium)).padding(.horizontal, 14).padding(.vertical, 9)
                }
                .buttonStyle(.plain).glass(interactive: true)
                .transition(.scale(scale: 0.9).combined(with: .opacity))
            } else if !preview.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(Array(preview.enumerated()), id: \.offset) { i, p in chip(i, p) }
                    }
                    .padding(.horizontal, 2)
                }
                .scrollClipDisabled()
                .transition(.move(edge: .bottom).combined(with: .opacity))
            } else if focused && text.isEmpty && !usuals.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(usuals, id: \.id) { e in
                            Button { repeatEntry(e) } label: {
                                HStack(spacing: 6) {
                                    Image(systemName: "arrow.clockwise").font(.system(size: 11, weight: .bold))
                                    Text(e.label).lineLimit(1)
                                    Text(Money.format(e.amount, settings.currency)).fontWeight(.semibold).monospacedDigit()
                                }
                                .font(.system(size: 14)).padding(.horizontal, 12).padding(.vertical, 8)
                            }
                            .buttonStyle(.plain).glass(interactive: true)
                        }
                    }
                }
                .scrollClipDisabled()
                .transition(.opacity)
            }

            HStack(spacing: 10) {
                TextField("Bolt 6k, lunch 4.5k, got paid 350k…", text: $text)
                    .focused($focused)
                    .submitLabel(question ? .search : .done)
                    .onSubmit(send)
                    .font(.system(size: 17))
                    .padding(.leading, 18).padding(.vertical, 14)
                Button(action: send) {
                    Group {
                        if busy { ProgressView().tint(Color(hex: 0x1E1B16)) }
                        else { Image(systemName: question ? "sparkles" : "arrow.up").font(.system(size: 16, weight: .bold)) }
                    }
                    .foregroundStyle(Color(hex: 0x1E1B16))
                    .frame(width: 38, height: 38)
                    .background(Theme.gold.opacity(text.trimmingCharacters(in: .whitespaces).isEmpty ? 0.35 : 1), in: Circle())
                }
                .disabled(text.trimmingCharacters(in: .whitespaces).isEmpty || busy)
                .accessibilityLabel(question ? "Ask" : "Add")
                .padding(.trailing, 7)
            }
            .glass(in: RoundedRectangle(cornerRadius: 26, style: .continuous), interactive: true)
        }
        .padding(.horizontal, 14)
        .padding(.bottom, 8)
        .animation(Theme.spring, value: preview.count)
        .animation(Theme.spring, value: question)
        .animation(Theme.spring, value: model.toast)
        .onChange(of: text) { _, _ in if text.isEmpty { overrides = [:]; flipped = [] } }
    }

    private func chip(_ i: Int, _ p: Parsed) -> some View {
        Menu {
            Button(p.direction == .moneyIn ? "Make it money out" : "Make it money in", systemImage: "arrow.left.arrow.right") {
                if flipped.contains(i) { flipped.remove(i) } else { flipped.insert(i) }
                overrides[i] = nil
                Haptics.select()
            }
            Section("Category") {
                ForEach(Categories.list(p.direction)) { c in
                    Button(c.name, systemImage: c.symbol) { overrides[i] = c.id; Haptics.select() }
                }
            }
        } label: {
            HStack(spacing: 7) {
                Circle().fill(p.cat.color).frame(width: 8, height: 8)
                Text(p.label).lineLimit(1)
                Text((p.direction == .moneyIn ? "+" : "−") + Money.format(p.amount, settings.currency))
                    .fontWeight(.semibold).monospacedDigit()
                    .foregroundStyle(p.direction == .moneyIn ? Theme.moneyIn : Theme.ink)
                if p.day != Day.today { Text(Day.label(p.day)).foregroundStyle(Theme.ink3) }
            }
            .font(.system(size: 14))
            .padding(.horizontal, 12).padding(.vertical, 8)
        }
        .buttonStyle(.plain)
        .glass(interactive: true)
    }

    private func send() {
        let t = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !t.isEmpty, !busy else { return }
        if question { text = ""; focused = false; model.ask(t); return }
        let local = preview
        guard !local.isEmpty else { Haptics.warning(); model.toast = "No amount in that. Try “lunch 4500”."; clearToastLater(); return }
        busy = true
        Task {
            // Muse reads it when switched on; the Oracle's reading (with your chip changes) otherwise.
            var items = local
            var note: String?
            if settings.museReady {
                let r = await Muse.read(t, currency: settings.currency)
                if r.byMuse && r.items.count == local.count {
                    // Keep what you changed on the chips.
                    items = r.items.enumerated().map { i, p in (overrides[i] != nil || flipped.contains(i)) ? local[i] : p }
                } else if r.byMuse { items = r.items }
                if let e = r.error { note = "Read on this phone (\(e.prefix(40)))" }
            }
            for (i, p) in items.enumerated() where overrides[i] != nil { Learned.learn(label: p.label, category: p.category) }
            let made = items.map { $0.makeEntry() }
            for m in made { context.insert(m) }
            try? context.save()
            model.lastAdded = made.map(\.id)
            let total = items.reduce(0) { $0 + ($1.direction == .moneyIn ? $1.amount : -$1.amount) }
            model.toast = note ?? (items.count == 1 ? "Added \(items[0].label), \(Money.format(items[0].amount, settings.currency))"
                                   : "Added \(items.count) entries, \(Money.format(total, settings.currency, sign: true))")
            text = ""
            busy = false
            Haptics.success()
            clearToastLater()
        }
    }

    private func repeatEntry(_ e: Entry) {
        let n = Entry(text: e.text, label: e.label, amount: e.amount, direction: e.direction, category: e.category, day: Day.today, source: "manual")
        context.insert(n)
        try? context.save()
        model.lastAdded = [n.id]
        model.toast = "Added \(e.label) again, \(Money.format(e.amount, settings.currency))"
        Haptics.success()
        clearToastLater()
    }

    private func undo() {
        let ids = Set(model.lastAdded)
        for e in entries where ids.contains(e.id) { context.delete(e) }
        try? context.save()
        model.lastAdded = []
        model.toast = nil
        Haptics.tap()
    }

    private func clearToastLater() {
        let current = model.toast
        Task {
            try? await Task.sleep(for: .seconds(4))
            if model.toast == current { model.toast = nil; model.lastAdded = [] }
        }
    }
}

struct ToastView: View {
    let text: String
    var undo: (() -> Void)?
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "checkmark.circle.fill").foregroundStyle(Theme.moneyIn)
            Text(text).font(.system(size: 14, weight: .medium)).lineLimit(2)
            Spacer(minLength: 0)
            if let undo { Button("Undo", action: undo).font(.system(size: 14, weight: .semibold)) }
        }
        .padding(.horizontal, 16).padding(.vertical, 11)
        .glass(in: RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
}

extension Parsed {
    var cat: MoneyCategory { Categories.of(category) }
}
