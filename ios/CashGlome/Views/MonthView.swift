import SwiftUI
import SwiftData
import Charts

/// The month at a glance: its painting, what came in, what went out, what you kept, and where it went.
/// Summary first; every number opens onto the entries behind it.
struct MonthView: View {
    @EnvironmentObject private var settings: AppSettings
    @EnvironmentObject private var model: AppModel
    @Query(sort: \Entry.day, order: .reverse) private var entries: [Entry]

    private var stats: MonthStats { MonthStats(entries, month: model.month) }
    private var previous: MonthStats { MonthStats(entries, month: Day.shiftMonth(model.month, -1)) }
    private var cur: String { settings.currency }

    var body: some View {
        let s = stats
        let character = Paintings.character(s)
        ScrollView {
            VStack(spacing: 16) {
                MonthHero(month: model.month, stats: s, character: character)
                    .gesture(DragGesture(minimumDistance: 30).onEnded { v in
                        if v.translation.width < -60 { step(1) } else if v.translation.width > 60 { step(-1) }
                    })

                if s.entries.isEmpty {
                    EmptyMonth(isCurrent: s.isCurrent)
                        .padding(.horizontal, 16)
                } else {
                    VStack(spacing: 16) {
                        SummaryCard(stats: s, previous: previous, currency: cur)
                        if s.isCurrent && s.spend > 0 { PaceCard(stats: s, currency: cur) }
                        DailyChart(stats: s, currency: cur)
                        WhereItWent(stats: s, currency: cur)
                        MomentsGrid(moments: Insights.moments(s, currency: cur))
                        RepeatsCard(items: Insights.recurring(entries), currency: cur)
                        Text("CashGlome shows what you've written down. It isn't financial advice.")
                            .font(.footnote).foregroundStyle(Theme.ink3).multilineTextAlignment(.center)
                            .padding(.top, 4).padding(.bottom, 20)
                    }
                    .padding(.horizontal, 16)
                }
            }
        }
        .scrollIndicators(.hidden)
        .background(Theme.canvas.ignoresSafeArea())
        .ignoresSafeArea(edges: .top)
        .safeAreaInset(edge: .bottom) { ComposerBar() }
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button { step(-1) } label: { Image(systemName: "chevron.left") }
                    .accessibilityLabel("Previous month")
            }
            ToolbarItem(placement: .topBarTrailing) {
                Button { step(1) } label: { Image(systemName: "chevron.right") }
                    .disabled(model.month >= Day.thisMonth)
                    .accessibilityLabel("Next month")
            }
        }
        .toolbarBackground(.hidden, for: .navigationBar)
        .sensoryFeedback(.selection, trigger: model.month)
    }

    private func step(_ d: Int) {
        let next = Day.shiftMonth(model.month, d)
        guard next <= Day.thisMonth else { return }
        withAnimation(Theme.spring) { model.month = next }
    }
}

// MARK: Hero

struct MonthHero: View {
    let month: String
    let stats: MonthStats
    let character: (name: String, line: String, painting: Painting)

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            character.painting.image
                .resizable()
                .aspectRatio(contentMode: .fill)
                .frame(maxWidth: .infinity)
                .frame(height: 440)
                .clipped()
                .overlay(
                    LinearGradient(stops: [
                        .init(color: .black.opacity(0.35), location: 0),
                        .init(color: .clear, location: 0.3),
                        .init(color: Theme.canvas.opacity(0.55), location: 0.68),
                        .init(color: Theme.canvas, location: 1),
                    ], startPoint: .top, endPoint: .bottom)
                )
                // Stretches when you pull down, drifts slower than the page when you scroll: depth, at 120 Hz.
                .visualEffect { content, proxy in
                    let y = proxy.frame(in: .scrollView).minY
                    return content
                        .scaleEffect(y > 0 ? 1 + y / 440 : 1, anchor: .bottom)
                        .offset(y: y > 0 ? -y / 2 : -y * 0.3)
                }
                .id(character.painting.id)
                .transition(.opacity)

            VStack(alignment: .leading, spacing: 6) {
                Text(Day.monthTitle(month, year: true))
                    .eyebrow()
                Text(Day.monthTitle(month, year: false))
                    .font(Theme.display(54, .regular))
                    .foregroundStyle(Theme.ink)
                    .contentTransition(.opacity)
                HStack(spacing: 8) {
                    Text(character.name).font(Theme.display(19).italic())
                    Text("·").foregroundStyle(Theme.ink3)
                    Text(character.line).font(.system(size: 15)).foregroundStyle(Theme.ink2).lineLimit(1)
                }
                Text("\(character.painting.title), \(character.painting.artist), \(character.painting.year)")
                    .font(.system(size: 11)).foregroundStyle(Theme.ink3).padding(.top, 2)
            }
            .padding(.horizontal, 20).padding(.bottom, 8)
        }
        .animation(.easeInOut(duration: 0.4), value: character.painting.id)
    }
}

struct EmptyMonth: View {
    let isCurrent: Bool
    var body: some View {
        Card {
            VStack(alignment: .leading, spacing: 8) {
                Text(isCurrent ? "A clean canvas" : "Nothing written this month").font(Theme.display(24))
                Text(isCurrent ? "Write what you spent or got below, the way you'd text a friend: “lunch 4500, uber 3k”." : "Swipe to another month, or add something you remember.")
                    .foregroundStyle(Theme.ink2)
            }
        }
    }
}

// MARK: Summary

struct SummaryCard: View {
    let stats: MonthStats
    let previous: MonthStats
    let currency: String

    var body: some View {
        Card {
            VStack(alignment: .leading, spacing: 18) {
                HStack(alignment: .firstTextBaseline) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Spent").eyebrow()
                        Text(Money.format(stats.spend, currency))
                            .font(Theme.number(40, .semibold))
                            .foregroundStyle(Theme.ink)
                            .contentTransition(.numericText(value: stats.spend))
                        if previous.spend > 0 {
                            let sameDays = previous.days.prefix(stats.dayOfMonth).reduce(0) { $0 + $1.moneyOut }
                            let base = stats.isCurrent ? sameDays : previous.spend
                            if base > 0 {
                                let change = (stats.spend - base) / base
                                Label("\(Int(abs(change * 100).rounded()))% \(change >= 0 ? "more" : "less") than \(stats.isCurrent ? "this point last month" : "last month")",
                                      systemImage: change >= 0 ? "arrow.up.right" : "arrow.down.right")
                                    .font(.system(size: 13, weight: .medium))
                                    .foregroundStyle(change > 0.05 ? Theme.moneyOut : Theme.moneyIn)
                            }
                        }
                    }
                    Spacer()
                    KeptRing(rate: stats.keptRate)
                }
                Divider().overlay(Theme.hairline)
                HStack {
                    figure("Came in", stats.moneyIn, Theme.moneyIn)
                    Spacer()
                    figure("Put aside", stats.putAside, Theme.saved)
                    Spacer()
                    figure("Entries", Double(stats.entries.count), Theme.ink, plain: true)
                }
            }
        }
    }

    private func figure(_ title: String, _ value: Double, _ color: Color, plain: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(title).font(.system(size: 12, weight: .medium)).foregroundStyle(Theme.ink3)
            Text(plain ? "\(Int(value))" : Money.format(value, currency, compact: true))
                .font(Theme.number(19)).foregroundStyle(color)
                .contentTransition(.numericText(value: value))
        }
    }
}

/// How much of what came in you kept. (Not "left to spend": knowing exactly what's left near month end
/// tends to make people spend it, so CashGlome frames it as what you kept.)
struct KeptRing: View {
    let rate: Double
    var body: some View {
        ZStack {
            Circle().stroke(Theme.raised, lineWidth: 8)
            Circle().trim(from: 0, to: max(0.001, min(1, rate)))
                .stroke(Theme.saved.gradient, style: StrokeStyle(lineWidth: 8, lineCap: .round))
                .rotationEffect(.degrees(-90))
            VStack(spacing: 0) {
                Text("\(Int((rate * 100).rounded()))%").font(Theme.number(18))
                Text("kept").font(.system(size: 10, weight: .medium)).foregroundStyle(Theme.ink3)
            }
        }
        .frame(width: 76, height: 76)
        .animation(.spring(response: 0.6, dampingFraction: 0.8), value: rate)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Kept \(Int((rate * 100).rounded())) percent of what came in")
    }
}

struct PaceCard: View {
    let stats: MonthStats
    let currency: String
    var body: some View {
        Card {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Text("Pace").eyebrow()
                    Spacer()
                    Text("Day \(stats.dayOfMonth) of \(stats.daysInMonth)").font(.system(size: 12, weight: .medium)).foregroundStyle(Theme.ink3)
                }
                Text("At this pace, about **\(Money.format(stats.projectedSpend, currency, compact: true))** by the end of the month.")
                    .font(Theme.display(20))
                GeometryReader { g in
                    let cap = max(stats.projectedSpend, stats.moneyIn, 1)
                    ZStack(alignment: .leading) {
                        Capsule().fill(Theme.raised)
                        Capsule().fill(Theme.moneyOut.opacity(0.25)).frame(width: g.size.width * stats.projectedSpend / cap)
                        Capsule().fill(Theme.moneyOut.gradient).frame(width: g.size.width * stats.spend / cap)
                        if stats.moneyIn > 0 {
                            Rectangle().fill(Theme.moneyIn).frame(width: 2, height: 18).offset(x: g.size.width * stats.moneyIn / cap - 1)
                        }
                    }
                }
                .frame(height: 12)
                HStack(spacing: 14) {
                    legend(Theme.moneyOut, "Spent so far")
                    legend(Theme.moneyOut.opacity(0.3), "Likely by month end")
                    if stats.moneyIn > 0 { legend(Theme.moneyIn, "Came in") }
                }
                Text("About \(Money.format(stats.dailyPace, currency)) a day on day-to-day things; rent, bills and renewals counted once.")
                    .font(.footnote).foregroundStyle(Theme.ink3)
            }
        }
    }
    private func legend(_ c: Color, _ t: String) -> some View {
        HStack(spacing: 5) { Circle().fill(c).frame(width: 7, height: 7); Text(t) }.font(.system(size: 11, weight: .medium)).foregroundStyle(Theme.ink2)
    }
}

// MARK: Day by day

struct DailyChart: View {
    let stats: MonthStats
    let currency: String
    @State private var selected: Date?

    private var picked: DayTotal? {
        guard let selected else { return nil }
        return stats.days.min { abs($0.date.timeIntervalSince(selected)) < abs($1.date.timeIntervalSince(selected)) }
    }

    var body: some View {
        Card {
            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .firstTextBaseline) {
                    Text("Day by day").eyebrow()
                    Spacer()
                    if let d = picked {
                        Text("\(Day.label(d.day)): \(Money.format(d.moneyOut, currency))\(d.moneyIn > 0 ? ", +\(Money.format(d.moneyIn, currency)) in" : "")")
                            .font(.system(size: 13, weight: .semibold)).monospacedDigit()
                            .transition(.opacity)
                    } else {
                        Text("Touch and drag to read a day").font(.system(size: 12)).foregroundStyle(Theme.ink3)
                    }
                }
                Chart {
                    ForEach(stats.days) { d in
                        BarMark(x: .value("Day", d.date, unit: .day), y: .value("Spent", d.moneyOut))
                            .foregroundStyle(picked?.day == d.day ? AnyShapeStyle(Theme.gold) : AnyShapeStyle(Theme.moneyOut.opacity(d.day > Day.today ? 0.2 : 0.85)))
                            .cornerRadius(3)
                        if d.moneyIn > 0 {
                            PointMark(x: .value("Day", d.date, unit: .day), y: .value("In", 0.0))
                                .symbolSize(28).foregroundStyle(Theme.moneyIn)
                        }
                    }
                    if stats.dailyPace > 0 {
                        RuleMark(y: .value("Average", stats.dailyPace))
                            .lineStyle(StrokeStyle(lineWidth: 1, dash: [3, 4]))
                            .foregroundStyle(Theme.ink3)
                    }
                }
                .chartXSelection(value: $selected)
                .chartYAxis {
                    AxisMarks(position: .trailing, values: .automatic(desiredCount: 3)) { v in
                        AxisGridLine().foregroundStyle(Theme.hairline)
                        AxisValueLabel { if let n = v.as(Double.self) { Text(Money.format(n, currency, compact: true)).font(.system(size: 10)) } }
                    }
                }
                .chartXAxis {
                    AxisMarks(values: .stride(by: .day, count: 7)) { _ in
                        AxisValueLabel(format: .dateTime.day(), centered: true).font(.system(size: 10))
                    }
                }
                .frame(height: 170)
                .sensoryFeedback(.selection, trigger: picked?.day)
                Text("Bars are spending (savings not counted). Green dots are money in. The dashed line is your usual day.")
                    .font(.footnote).foregroundStyle(Theme.ink3)
            }
        }
    }
}

// MARK: Where it went

struct WhereItWent: View {
    let stats: MonthStats
    let currency: String
    @State private var selectedAngle: Double?

    private var selected: CategoryTotal? {
        guard let a = selectedAngle else { return nil }
        var acc = 0.0
        for c in stats.byCategory { acc += c.total; if a <= acc { return c } }
        return nil
    }

    var body: some View {
        Card {
            VStack(alignment: .leading, spacing: 14) {
                Text("Where it went").eyebrow()
                Chart(stats.byCategory) { c in
                    SectorMark(angle: .value("Spent", c.total), innerRadius: .ratio(0.64), angularInset: 1.5)
                        .cornerRadius(4)
                        .foregroundStyle(c.cat.color)
                        .opacity(selected == nil || selected?.id == c.id ? 1 : 0.35)
                }
                .chartAngleSelection(value: $selectedAngle)
                .chartBackground { _ in
                    VStack(spacing: 2) {
                        Text(selected?.cat.name ?? "Spent").font(.system(size: 13, weight: .medium)).foregroundStyle(Theme.ink2)
                        Text(Money.format(selected?.total ?? stats.spend, currency, compact: true)).font(Theme.number(26))
                            .contentTransition(.numericText())
                        if let s = selected { Text("\(Int((s.share * 100).rounded()))%").font(.system(size: 12)).foregroundStyle(Theme.ink3) }
                    }
                    .animation(Theme.snappy, value: selected?.id)
                }
                .frame(height: 220)
                .sensoryFeedback(.selection, trigger: selected?.id)

                VStack(spacing: 4) {
                    ForEach(stats.byCategory) { c in
                        NavigationLink {
                            CategoryDetailView(category: c.id, month: stats.month)
                        } label: {
                            CategoryRow(total: c, max: stats.byCategory.first?.total ?? 1, currency: currency)
                        }
                        .buttonStyle(PressableStyle())
                    }
                }
            }
        }
    }
}

struct CategoryRow: View {
    let total: CategoryTotal
    let max: Double
    let currency: String
    var body: some View {
        HStack(spacing: 12) {
            CategoryBadge(cat: total.cat, size: 34)
            VStack(alignment: .leading, spacing: 5) {
                HStack {
                    Text(total.cat.name).font(.system(size: 15, weight: .medium)).foregroundStyle(Theme.ink)
                    Spacer()
                    Text(Money.format(total.total, currency)).font(Theme.number(15)).foregroundStyle(Theme.ink)
                }
                GeometryReader { g in
                    Capsule().fill(total.cat.color.opacity(0.85)).frame(width: Swift.max(4, g.size.width * total.total / Swift.max(max, 1)))
                }
                .frame(height: 4)
            }
            Image(systemName: "chevron.right").font(.system(size: 12, weight: .semibold)).foregroundStyle(Theme.ink3)
        }
        .padding(.vertical, 6)
        .contentShape(Rectangle())
    }
}

// MARK: Moments and repeats

struct MomentsGrid: View {
    let moments: [Insights.Moment]
    var body: some View {
        LazyVGrid(columns: [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)], spacing: 12) {
            ForEach(moments) { m in
                VStack(alignment: .leading, spacing: 8) {
                    Image(systemName: m.symbol).font(.system(size: 16, weight: .semibold)).foregroundStyle(Theme.gold)
                    Text(m.title).font(.system(size: 12, weight: .medium)).foregroundStyle(Theme.ink3)
                    Text(m.value).font(Theme.display(22)).foregroundStyle(Theme.ink).lineLimit(1).minimumScaleFactor(0.7)
                    Text(m.note).font(.system(size: 12)).foregroundStyle(Theme.ink2).lineLimit(2)
                }
                .padding(16)
                .frame(maxWidth: .infinity, minHeight: 140, alignment: .topLeading)
                .background(Theme.surface, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 22, style: .continuous).strokeBorder(Theme.hairline))
            }
        }
    }
}

struct RepeatsCard: View {
    let items: [Recurring]
    let currency: String
    var body: some View {
        if !items.isEmpty {
            Card {
                VStack(alignment: .leading, spacing: 12) {
                    Text("Comes back every month").eyebrow()
                    let monthly = items.reduce(0) { $0 + $1.amount }
                    Text("\(Money.format(monthly, currency)) a month, or \(Money.format(monthly * 12, currency, compact: true)) a year. Worth a look now and then.")
                        .font(Theme.display(18))
                    ForEach(items) { r in
                        HStack(spacing: 12) {
                            CategoryBadge(cat: Categories.of(r.category), size: 30)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(r.label).font(.system(size: 15, weight: .medium))
                                Text("\(r.months) \(r.months == 1 ? "month" : "months") running").font(.system(size: 12)).foregroundStyle(Theme.ink3)
                            }
                            Spacer()
                            Text(Money.format(r.amount, currency)).font(Theme.number(15))
                        }
                    }
                }
            }
        }
    }
}

// MARK: One category

struct CategoryDetailView: View {
    let category: String
    let month: String
    @EnvironmentObject private var settings: AppSettings
    @Query(sort: \Entry.day, order: .reverse) private var entries: [Entry]

    var body: some View {
        let cat = Categories.of(category)
        let list = entries.filter { $0.category == category && $0.month == month }
        let total = list.reduce(0) { $0 + $1.amount }
        List {
            Section {
                VStack(alignment: .leading, spacing: 6) {
                    CategoryBadge(cat: cat, size: 44)
                    Text(Money.format(total, settings.currency)).font(Theme.number(34))
                    Text("\(list.count) \(list.count == 1 ? "time" : "times") in \(Day.monthTitle(month, year: false)), about \(Money.format(total / Double(max(1, list.count)), settings.currency)) each")
                        .foregroundStyle(Theme.ink2)
                }
                .listRowBackground(Color.clear)
            }
            Section {
                ForEach(list) { e in EntryRow(entry: e, currency: settings.currency) }
            }
        }
        .scrollContentBackground(.hidden)
        .background(Theme.canvas)
        .navigationTitle(cat.name)
        .navigationBarTitleDisplayMode(.inline)
    }
}
