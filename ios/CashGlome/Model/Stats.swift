import Foundation

struct CategoryTotal: Identifiable, Hashable {
    let id: String
    let total: Double
    let count: Int
    let share: Double
    var cat: MoneyCategory { Categories.of(id) }
}

struct DayTotal: Identifiable, Hashable {
    let day: String
    let moneyIn: Double
    let moneyOut: Double
    let count: Int
    var id: String { day }
    var date: Date { Day.date(day) }
}

/// One month, counted. Every number on screen comes from here, never from Muse.
struct MonthStats {
    let month: String
    let entries: [Entry]
    let moneyIn: Double
    /// Everything that went out, savings included.
    let outflow: Double
    /// Spending: what went out, not counting savings and investing.
    let spend: Double
    /// Put aside: savings and investing.
    let putAside: Double
    let byCategory: [CategoryTotal]
    let incomeByCategory: [CategoryTotal]
    let days: [DayTotal]
    let biggest: Entry?
    let joy: Double
    let regret: Double
    let daysLogged: Int
    let dayOfMonth: Int
    let daysInMonth: Int
    let isCurrent: Bool

    init(_ all: [Entry], month: String) {
        self.month = month
        let list = all.filter { $0.month == month }.sorted { ($0.day, $0.createdAt) < ($1.day, $1.createdAt) }
        entries = list
        let ins = list.filter(\.isIn), outs = list.filter { !$0.isIn }
        moneyIn = ins.reduce(0) { $0 + $1.amount }
        outflow = outs.reduce(0) { $0 + $1.amount }
        putAside = outs.filter { $0.cat.nature == .save }.reduce(0) { $0 + $1.amount }
        spend = outflow - putAside

        func group(_ l: [Entry], of total: Double) -> [CategoryTotal] {
            Dictionary(grouping: l, by: \.category)
                .map { id, es in
                    let t = es.reduce(0) { $0 + $1.amount }
                    return CategoryTotal(id: id, total: t, count: es.count, share: total > 0 ? t / total : 0)
                }
                .sorted { $0.total > $1.total }
        }
        let spendOnly = outs.filter { $0.cat.nature != .save }
        byCategory = group(spendOnly, of: spend)
        incomeByCategory = group(ins, of: moneyIn)

        daysInMonth = Day.daysIn(month)
        isCurrent = month == Day.thisMonth
        dayOfMonth = isCurrent ? (Int(Day.today.suffix(2)) ?? 1) : daysInMonth
        let byDay = Dictionary(grouping: list, by: \.day)
        days = (1...daysInMonth).map { d in
            let key = month + String(format: "-%02d", d)
            let es = byDay[key] ?? []
            return DayTotal(day: key,
                            moneyIn: es.filter(\.isIn).reduce(0) { $0 + $1.amount },
                            moneyOut: es.filter { !$0.isIn && $0.cat.nature != .save }.reduce(0) { $0 + $1.amount },
                            count: es.count)
        }
        biggest = spendOnly.max { $0.amount < $1.amount }
        joy = list.filter { $0.feeling == .joy }.reduce(0) { $0 + $1.amount }
        regret = list.filter { $0.feeling == .regret }.reduce(0) { $0 + $1.amount }
        daysLogged = Set(list.map(\.day)).count
    }

    /// Kept: share of what came in that wasn't spent.
    var keptRate: Double { moneyIn > 0 ? max(0, (moneyIn - spend) / moneyIn) : 0 }
    var net: Double { moneyIn - outflow }

    private static let fixed: Set<String> = ["rent", "bills", "subscriptions", "debt", "education"]
    /// Month-end estimate: day-to-day spending scales with the days left; rent, bills and renewals don't.
    var projectedSpend: Double {
        let d = Double(max(1, dayOfMonth))
        let fixedTotal = byCategory.filter { Self.fixed.contains($0.id) }.reduce(0) { $0 + $1.total }
        let variable = max(0, spend - fixedTotal)
        return fixedTotal + variable / d * Double(daysInMonth)
    }
    var dailyPace: Double {
        let fixedTotal = byCategory.filter { Self.fixed.contains($0.id) }.reduce(0) { $0 + $1.total }
        return max(0, spend - fixedTotal) / Double(max(1, dayOfMonth))
    }
    var needs: Double { entries.filter { !$0.isIn && $0.cat.nature == .need }.reduce(0) { $0 + $1.amount } }
    var wants: Double { entries.filter { !$0.isIn && $0.cat.nature == .want }.reduce(0) { $0 + $1.amount } }
}

/// Repeats: the same label in two or more months, or anything filed as a subscription.
struct Recurring: Identifiable, Hashable {
    let label: String
    let category: String
    let amount: Double
    let months: Int
    var id: String { label.lowercased() }
}

enum Insights {
    static func recurring(_ all: [Entry]) -> [Recurring] {
        let groups = Dictionary(grouping: all.filter { !$0.isIn }, by: { $0.label.lowercased().trimmingCharacters(in: .whitespaces) })
        var res: [Recurring] = []
        for (_, list) in groups {
            let sorted = list.sorted { $0.day < $1.day }
            guard let last = sorted.last, last.cat.nature != .save else { continue }
            let months = Set(list.map(\.month)).count
            if (months >= 2 && Double(list.count) <= Double(months) * 1.5) || last.category == "subscriptions" {
                res.append(Recurring(label: last.label, category: last.category, amount: last.amount, months: months))
            }
        }
        return Array(res.sorted { $0.amount > $1.amount }.prefix(8))
    }

    /// One-tap repeats: the same label and amount at least twice in the last 60 days.
    static func usuals(_ all: [Entry], limit: Int = 3) -> [Entry] {
        let from = Day.add(-60, to: Day.today)
        var groups: [String: (e: Entry, count: Int)] = [:]
        for e in all where !e.isIn && e.day >= from {
            let k = "\(e.label.lowercased())|\(e.amount)"
            if let g = groups[k] { groups[k] = (e.day >= g.e.day ? e : g.e, g.count + 1) } else { groups[k] = (e, 1) }
        }
        return groups.values.filter { $0.count >= 2 }
            .sorted { $0.count != $1.count ? $0.count > $1.count : $0.e.day > $1.e.day }
            .prefix(limit).map(\.e)
    }

    /// A few plain lines about the month, worked out here.
    struct Moment: Identifiable { let title: String; let value: String; let note: String; let symbol: String; var id: String { title } }

    static func moments(_ s: MonthStats, currency: String) -> [Moment] {
        var out: [Moment] = []
        if let b = s.biggest {
            out.append(Moment(title: "Biggest spend", value: Money.format(b.amount, currency), note: "\(b.label), \(Day.short(b.day))", symbol: "arrow.up.forward.circle.fill"))
        }
        if let top = s.byCategory.first {
            out.append(Moment(title: "Most went on", value: top.cat.name, note: "\(Int((top.share * 100).rounded()))% of spending, \(top.count) \(top.count == 1 ? "time" : "times")", symbol: top.cat.symbol))
        }
        let small = s.entries.filter { !$0.isIn && $0.amount < max(1, s.spend * 0.02) }
        if small.count >= 3 {
            out.append(Moment(title: "Small spends", value: Money.format(small.reduce(0) { $0 + $1.amount }, currency), note: "\(small.count) little things that add up quietly", symbol: "circle.grid.3x3.fill"))
        }
        // Longest run of days with nothing spent.
        var run = 0, longest = 0
        for d in s.days.prefix(s.dayOfMonth) { if d.moneyOut == 0 { run += 1; longest = max(longest, run) } else { run = 0 } }
        out.append(Moment(title: "Quiet days in a row", value: longest == 0 ? "None yet" : "\(longest)", note: longest == 0 ? "Try one day with no spending" : "Your longest stretch with no spending", symbol: "moon.zzz.fill"))
        if s.regret > 0 {
            out.append(Moment(title: "Would take back", value: Money.format(s.regret, currency), note: "Marked as a regret this month", symbol: "arrow.uturn.backward.circle.fill"))
        }
        return out
    }
}
