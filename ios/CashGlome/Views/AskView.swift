import SwiftUI
import SwiftData

/// Ask anything about your money. Muse reads the question and searches your entries; the phone does every sum,
/// so the numbers are exact, and "Show the numbers" lists what each answer was built from.
struct AskView: View {
    @EnvironmentObject private var settings: AppSettings
    @EnvironmentObject private var model: AppModel
    @Query(sort: \Entry.day, order: .reverse) private var entries: [Entry]
    @Query private var goals: [Goal]

    @State private var turns: [Turn] = []
    @State private var text = ""
    @State private var step = ""
    @State private var busy = false
    @State private var consentFor: String?
    @FocusState private var focused: Bool

    private let suggestions = [
        "Where did my money go this month?",
        "Am I spending more than last month?",
        "What do I spend on most at weekends?",
        "How much have I spent on my family this year?",
        "What are my subscriptions costing me a year?",
        "Where could I cut back without missing much?",
    ]

    var body: some View {
        ScrollViewReader { reader in
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    header
                    if turns.isEmpty && consentFor == nil { suggestionList }
                    ForEach(turns) { t in TurnView(turn: t, step: t.id == turns.last?.id ? step : "", currency: settings.currency) }
                    if let q = consentFor { ConsentCard(question: q, decide: decide) }
                    Color.clear.frame(height: 1).id("end")
                }
                .padding(.horizontal, 18).padding(.top, 8).padding(.bottom, 24)
            }
            .scrollDismissesKeyboard(.interactively)
            .onChange(of: turns.count) { _, _ in withAnimation(Theme.spring) { reader.scrollTo("end", anchor: .bottom) } }
            .onChange(of: step) { _, _ in reader.scrollTo("end", anchor: .bottom) }
        }
        .background(Theme.canvas.ignoresSafeArea())
        .navigationTitle("Ask")
        .toolbar {
            if !turns.isEmpty {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { withAnimation(Theme.spring) { turns = [] } } label: { Image(systemName: "square.and.pencil") }
                        .accessibilityLabel("New conversation")
                }
            }
        }
        .safeAreaInset(edge: .bottom) { inputBar }
        .onAppear(perform: takePending)
        .onChange(of: model.pendingQuestion) { _, _ in takePending() }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Ask about your money").font(Theme.display(30))
            Text(settings.museReady && settings.askMuse == true
                 ? "Ask anything. Muse looks through your entries; your phone does the counting."
                 : settings.museReady ? "Ask anything. The first time, you'll be asked before anything is sent to Muse."
                 : "Counted on this phone. Add your Meta key in Settings to ask anything at all.")
                .font(.system(size: 15)).foregroundStyle(Theme.ink2)
        }
    }

    private var suggestionList: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Try one").eyebrow()
            ForEach(suggestions, id: \.self) { s in
                Button { ask(s) } label: {
                    HStack {
                        Text(s).font(.system(size: 16)).foregroundStyle(Theme.ink).multilineTextAlignment(.leading)
                        Spacer()
                        Image(systemName: "arrow.up.right").font(.system(size: 12, weight: .semibold)).foregroundStyle(Theme.ink3)
                    }
                    .padding(.horizontal, 16).padding(.vertical, 14)
                    .background(Theme.surface, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).strokeBorder(Theme.hairline))
                }
                .buttonStyle(PressableStyle())
            }
        }
    }

    private var inputBar: some View {
        HStack(spacing: 10) {
            TextField("Ask about your money", text: $text)
                .focused($focused)
                .submitLabel(.send)
                .onSubmit { ask(text) }
                .font(.system(size: 17))
                .padding(.leading, 18).padding(.vertical, 14)
            Button { ask(text) } label: {
                Image(systemName: "arrow.up").font(.system(size: 16, weight: .bold))
                    .foregroundStyle(Color(hex: 0x1E1B16))
                    .frame(width: 38, height: 38)
                    .background(Theme.gold.opacity(text.trimmingCharacters(in: .whitespaces).isEmpty || busy ? 0.35 : 1), in: Circle())
            }
            .disabled(text.trimmingCharacters(in: .whitespaces).isEmpty || busy)
            .accessibilityLabel("Ask")
            .padding(.trailing, 7)
        }
        .glass(in: RoundedRectangle(cornerRadius: 26, style: .continuous), interactive: true)
        .padding(.horizontal, 14).padding(.bottom, 8)
    }

    private func takePending() {
        guard let q = model.pendingQuestion else { return }
        model.pendingQuestion = nil
        ask(q)
    }

    private func ask(_ raw: String) {
        let q = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !q.isEmpty, !busy else { return }
        text = ""
        Haptics.tap()
        let engine = AskEngine(entries: entries, currency: settings.currency, name: settings.name, goals: goals)
        guard settings.museReady else { append(q, engine.answerLocally(q)); return }
        switch settings.askMuse {
        case nil: withAnimation(Theme.spring) { consentFor = q }
        case false?: append(q, engine.answerLocally(q))
        case true?: runMuse(q, engine)
        }
    }

    private func decide(_ yes: Bool) {
        settings.askMuse = yes
        guard let q = consentFor else { return }
        consentFor = nil
        let engine = AskEngine(entries: entries, currency: settings.currency, name: settings.name, goals: goals)
        if yes { runMuse(q, engine) } else { append(q, engine.answerLocally(q)) }
    }

    private func append(_ q: String, _ a: Answer) {
        withAnimation(Theme.spring) { turns.append(Turn(question: q, answer: a)) }
        Haptics.success()
    }

    private func runMuse(_ q: String, _ engine: AskEngine) {
        busy = true
        step = "Reading your question…"
        let turn = Turn(question: q, answer: nil)
        withAnimation(Theme.spring) { turns.append(turn) }
        let history = turns
        Task {
            var a: Answer
            do {
                a = try await engine.askMuse(q, history: history) { s in step = s }
            } catch {
                // Offline, or Muse is down: still answer what can be counted here.
                a = engine.answerLocally(q)
                a.error = error.localizedDescription
            }
            if let i = turns.firstIndex(where: { $0.id == turn.id }) {
                withAnimation(Theme.spring) { turns[i].answer = a }
            }
            busy = false
            step = ""
            Haptics.success()
        }
    }
}

struct TurnView: View {
    let turn: Turn
    let step: String
    let currency: String

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Spacer(minLength: 48)
                Text(turn.question)
                    .font(.system(size: 16))
                    .foregroundStyle(Color(hex: 0x1E1B16))
                    .padding(.horizontal, 14).padding(.vertical, 10)
                    .background(Theme.gold, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
            }
            if let a = turn.answer {
                VStack(alignment: .leading, spacing: 10) {
                    RichText(text: a.text)
                    if !a.figures.isEmpty || !a.rows.isEmpty {
                        DisclosureGroup {
                            VStack(alignment: .leading, spacing: 8) {
                                ForEach(a.figures) { f in
                                    HStack(alignment: .firstTextBaseline) {
                                        Text(f.label).font(.system(size: 13)).foregroundStyle(Theme.ink2)
                                        Spacer()
                                        Text(f.value).font(.system(size: 13, weight: .semibold)).monospacedDigit()
                                    }
                                }
                                if !a.rows.isEmpty { Divider().overlay(Theme.hairline) }
                                ForEach(a.rows) { r in
                                    HStack(spacing: 8) {
                                        Circle().fill(Categories.of(r.category).color).frame(width: 8, height: 8)
                                        Text(r.label).font(.system(size: 13)).lineLimit(1)
                                        Text(Day.short(r.day)).font(.system(size: 12)).foregroundStyle(Theme.ink3)
                                        Spacer()
                                        Text((r.isIn ? "+" : "−") + Money.format(r.amount, currency)).font(.system(size: 13, weight: .medium)).monospacedDigit()
                                            .foregroundStyle(r.isIn ? Theme.moneyIn : Theme.ink)
                                    }
                                }
                            }
                            .padding(.top, 8)
                        } label: {
                            Text("Show the numbers").font(.system(size: 14, weight: .semibold))
                        }
                        .tint(Theme.ink2)
                    }
                    HStack(spacing: 6) {
                        Image(systemName: a.source == .muse ? "sparkles" : "iphone")
                        Text(sourceLine(a))
                    }
                    .font(.system(size: 11, weight: .medium)).foregroundStyle(Theme.ink3)
                }
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Theme.surface, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous).strokeBorder(Theme.hairline))
                .transition(.opacity.combined(with: .move(edge: .bottom)))
            } else {
                HStack(spacing: 10) {
                    ThinkingDots()
                    Text(step.isEmpty ? "Thinking…" : step).font(.system(size: 14)).foregroundStyle(Theme.ink2)
                        .contentTransition(.opacity)
                        .animation(Theme.snappy, value: step)
                }
                .padding(.vertical, 6)
            }
        }
    }

    private func sourceLine(_ a: Answer) -> String {
        switch a.source {
        case .muse: return "Muse searched your entries; the numbers were counted on this phone"
        case .device: return "Worked out on this phone" + (a.error.map { " · Muse couldn't answer (\($0.prefix(50)))" } ?? "")
        case .help: return "On this phone" + (a.error.map { " · Muse couldn't answer (\($0.prefix(50)))" } ?? "")
        }
    }
}

/// Muse answers in short lines, "- " lists and **bold**. Shown as text, never as anything that could run.
struct RichText: View {
    let text: String
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach(Array(blocks.enumerated()), id: \.offset) { _, b in
                if b.isItem {
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Text("•").foregroundStyle(Theme.gold)
                        Text(inline(b.text))
                    }
                    .font(.system(size: 16))
                } else {
                    Text(inline(b.text)).font(Theme.display(18))
                }
            }
        }
        .foregroundStyle(Theme.ink)
        .textSelection(.enabled)
    }

    private var blocks: [(isItem: Bool, text: String)] {
        text.components(separatedBy: "\n").compactMap { line -> (isItem: Bool, text: String)? in
            let t = RX(#"^#+\s*"#).replace(line, with: "").trimmingCharacters(in: .whitespaces)
            guard !t.isEmpty else { return nil }
            if let g = RX(#"^(?:[-•*]|\d+[.)])\s+(.*)$"#).firstGroups(t), let item = g[1] { return (true, item) }
            return (false, t)
        }
    }
    private func inline(_ s: String) -> AttributedString {
        (try? AttributedString(markdown: s, options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace))) ?? AttributedString(s)
    }
}

struct ThinkingDots: View {
    @State private var on = false
    var body: some View {
        HStack(spacing: 5) {
            ForEach(0..<3) { i in
                Circle().fill(Theme.gold).frame(width: 7, height: 7)
                    .opacity(on ? 1 : 0.3)
                    .animation(.easeInOut(duration: 0.5).repeatForever().delay(Double(i) * 0.15), value: on)
            }
        }
        .onAppear { on = true }
        .accessibilityHidden(true)
    }
}

struct ConsentCard: View {
    let question: String
    let decide: (Bool) -> Void
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Label("Let Muse answer any question?", systemImage: "sparkles").font(.system(size: 17, weight: .semibold))
            Text("Muse reads your question and asks your phone to search your entries. Your question, your monthly totals and the entries each search finds (names, amounts, dates, categories) are sent to Meta Muse. The adding up happens on your phone, and photos are never sent.")
                .font(.system(size: 14)).foregroundStyle(Theme.ink2)
            HStack(spacing: 10) {
                Button("Use Muse") { decide(true) }.buttonStyle(PrimaryButtonStyle())
                Button("Keep it on this phone") { decide(false) }
                    .font(.system(size: 15, weight: .medium))
                    .padding(.vertical, 15).frame(maxWidth: .infinity)
                    .background(Theme.raised, in: Capsule())
            }
            Text("You can change this any time in Settings.").font(.footnote).foregroundStyle(Theme.ink3)
        }
        .padding(18)
        .background(Theme.surface, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 24, style: .continuous).strokeBorder(Theme.gold.opacity(0.5)))
    }
}
