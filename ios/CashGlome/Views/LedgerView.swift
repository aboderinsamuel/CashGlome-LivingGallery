import SwiftUI
import SwiftData

/// Every entry, newest first, grouped by day. Search, swipe to delete, tap to change anything.
/// A category you correct here is remembered for next time.
struct LedgerView: View {
    @Environment(\.modelContext) private var context
    @EnvironmentObject private var settings: AppSettings
    @Query(sort: [SortDescriptor(\Entry.day, order: .reverse), SortDescriptor(\Entry.createdAt, order: .reverse)]) private var entries: [Entry]
    @State private var search = ""
    @State private var editing: Entry?
    @State private var filter: Direction?

    private var shown: [Entry] {
        let q = search.trimmingCharacters(in: .whitespaces).lowercased()
        return entries.filter { e in
            (filter == nil || e.direction == filter) &&
            (q.isEmpty || e.label.lowercased().contains(q) || e.text.lowercased().contains(q) || e.cat.name.lowercased().contains(q))
        }
    }
    private var days: [(day: String, items: [Entry])] {
        var order: [String] = []
        var groups: [String: [Entry]] = [:]
        for e in shown { if groups[e.day] == nil { order.append(e.day) }; groups[e.day, default: []].append(e) }
        return order.map { ($0, groups[$0] ?? []) }
    }

    var body: some View {
        List {
            if entries.isEmpty {
                ContentUnavailableView("Nothing written yet", systemImage: "square.and.pencil",
                                       description: Text("Write what you spent or got at the bottom, like “lunch 4500, uber 3k”."))
                    .listRowBackground(Color.clear)
            } else if shown.isEmpty {
                ContentUnavailableView.search(text: search).listRowBackground(Color.clear)
            }
            ForEach(days, id: \.day) { group in
                Section {
                    ForEach(group.items) { e in
                        Button { editing = e } label: { EntryRow(entry: e, currency: settings.currency) }
                            .buttonStyle(PressableStyle())
                            .listRowBackground(Theme.surface)
                            .swipeActions(edge: .trailing) {
                                Button(role: .destructive) { delete(e) } label: { Label("Delete", systemImage: "trash") }
                            }
                            .swipeActions(edge: .leading) {
                                Button { toggle(e, .joy) } label: { Label("Worth it", systemImage: "heart") }.tint(Theme.moneyIn)
                                Button { toggle(e, .regret) } label: { Label("Regret", systemImage: "arrow.uturn.backward") }.tint(Theme.moneyOut)
                            }
                    }
                } header: {
                    HStack {
                        Text(Day.label(group.day))
                        Spacer()
                        let out = group.items.filter { !$0.isIn }.reduce(0) { $0 + $1.amount }
                        let inn = group.items.filter(\.isIn).reduce(0) { $0 + $1.amount }
                        if inn > 0 { Text("+" + Money.format(inn, settings.currency)).foregroundStyle(Theme.moneyIn) }
                        if out > 0 { Text("−" + Money.format(out, settings.currency)) }
                    }
                    .font(.system(size: 13, weight: .semibold)).monospacedDigit()
                }
            }
        }
        .scrollContentBackground(.hidden)
        .background(Theme.canvas.ignoresSafeArea())
        .navigationTitle("Ledger")
        .searchable(text: $search, prompt: "Search entries")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Picker("Show", selection: $filter) {
                        Text("Everything").tag(Direction?.none)
                        Text("Money out").tag(Direction?.some(.moneyOut))
                        Text("Money in").tag(Direction?.some(.moneyIn))
                    }
                } label: { Image(systemName: filter == nil ? "line.3.horizontal.decrease.circle" : "line.3.horizontal.decrease.circle.fill") }
            }
        }
        .safeAreaInset(edge: .bottom) { ComposerBar() }
        .sheet(item: $editing) { e in EntryEditor(entry: e).presentationDetents([.medium, .large]).presentationDragIndicator(.visible) }
    }

    private func delete(_ e: Entry) {
        withAnimation { context.delete(e) }
        try? context.save()
        Haptics.tap()
    }
    private func toggle(_ e: Entry, _ f: Feeling) {
        e.feeling = e.feeling == f ? nil : f
        try? context.save()
        Haptics.select()
    }
}

struct EntryRow: View {
    let entry: Entry
    let currency: String
    var body: some View {
        HStack(spacing: 12) {
            CategoryBadge(cat: entry.cat, size: 36)
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 5) {
                    Text(entry.label).font(.system(size: 16, weight: .medium)).foregroundStyle(Theme.ink).lineLimit(1)
                    if let f = entry.feeling, f != .meh {
                        Image(systemName: f.symbol).font(.system(size: 11)).foregroundStyle(f == .joy ? Theme.moneyIn : Theme.moneyOut)
                    }
                }
                Text(entry.cat.name).font(.system(size: 13)).foregroundStyle(Theme.ink3)
            }
            Spacer(minLength: 8)
            Text((entry.isIn ? "+" : "−") + Money.format(entry.amount, currency))
                .font(Theme.number(16))
                .foregroundStyle(entry.isIn ? Theme.moneyIn : Theme.ink)
        }
        .padding(.vertical, 3)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }
}

/// Change anything about an entry. Changing its category teaches CashGlome for next time.
struct EntryEditor: View {
    @Bindable var entry: Entry
    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var context
    @EnvironmentObject private var settings: AppSettings
    @State private var amountText = ""
    @State private var date = Date()

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    HStack {
                        Text(Money.symbol(settings.currency)).font(Theme.number(30)).foregroundStyle(Theme.ink3)
                        TextField("0", text: $amountText).keyboardType(.decimalPad).font(Theme.number(34))
                    }
                    TextField("What it was", text: $entry.label)
                }
                Section {
                    Picker("Direction", selection: Binding(get: { entry.direction }, set: { d in
                        entry.direction = d
                        if entry.cat.direction != d { entry.category = d == .moneyIn ? "windfall" : "other" }
                    })) {
                        Text("Money out").tag(Direction.moneyOut)
                        Text("Money in").tag(Direction.moneyIn)
                    }
                    .pickerStyle(.segmented)
                    Picker("Category", selection: Binding(get: { entry.category }, set: { c in
                        entry.category = c
                        Learned.learn(label: entry.label, category: c)
                        Haptics.select()
                    })) {
                        ForEach(Categories.list(entry.direction)) { c in
                            Label(c.name, systemImage: c.symbol).tag(c.id)
                        }
                    }
                    DatePicker("Day", selection: $date, in: ...Date.now, displayedComponents: .date)
                    Picker("How it felt", selection: Binding(get: { entry.feeling }, set: { entry.feeling = $0 })) {
                        Text("Not said").tag(Feeling?.none)
                        ForEach(Feeling.allCases, id: \.self) { f in Text(f.title).tag(Feeling?.some(f)) }
                    }
                }
                Section {
                    Text("You wrote: “\(entry.text)”").font(.footnote).foregroundStyle(Theme.ink3)
                    Button("Delete entry", role: .destructive) {
                        context.delete(entry)
                        try? context.save()
                        Haptics.tap()
                        dismiss()
                    }
                }
            }
            .navigationTitle("Entry")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Done") { save(); dismiss() } }
            }
            .onAppear {
                amountText = entry.amount.truncatingRemainder(dividingBy: 1) == 0 ? String(Int(entry.amount)) : String(entry.amount)
                date = entry.date
            }
        }
    }

    private func save() {
        if let v = Double(amountText.replacingOccurrences(of: ",", with: "")), v > 0 { entry.amount = v }
        entry.day = Day.iso(date)
        if entry.label.trimmingCharacters(in: .whitespaces).isEmpty { entry.label = entry.cat.name }
        try? context.save()
        Haptics.success()
    }
}
