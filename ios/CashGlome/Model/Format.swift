import Foundation

/// Days are kept as "YYYY-MM-DD" strings in the person's own calendar, like the desktop app.
enum Day {
    static var calendar: Calendar { Calendar.current }

    static func iso(_ date: Date) -> String {
        let c = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 2000, c.month ?? 1, c.day ?? 1)
    }
    static var today: String { iso(.now) }

    /// Noon on that day, so daylight-saving changes never move it.
    static func date(_ iso: String) -> Date {
        let p = iso.split(separator: "-").compactMap { Int($0) }
        guard p.count >= 2 else { return .now }
        var c = DateComponents()
        c.year = p[0]; c.month = p[1]; c.day = p.count > 2 ? p[2] : 1; c.hour = 12
        return calendar.date(from: c) ?? .now
    }
    static func add(_ days: Int, to iso: String) -> String {
        Self.iso(calendar.date(byAdding: .day, value: days, to: date(iso)) ?? .now)
    }
    static func month(_ iso: String) -> String { String(iso.prefix(7)) }
    static var thisMonth: String { month(today) }

    static func shiftMonth(_ month: String, _ delta: Int) -> String {
        let d = calendar.date(byAdding: .month, value: delta, to: date(month + "-01")) ?? .now
        return String(iso(d).prefix(7))
    }
    static func daysIn(_ month: String) -> Int {
        calendar.range(of: .day, in: .month, for: date(month + "-01"))?.count ?? 30
    }
    /// 0 = Sunday … 6 = Saturday (the same numbering Muse is told about).
    static func weekday(_ iso: String) -> Int { calendar.component(.weekday, from: date(iso)) - 1 }
    static let weekdayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

    static func monthTitle(_ month: String, year: Bool = true) -> String {
        let f = DateFormatter()
        f.setLocalizedDateFormatFromTemplate(year ? "MMMM y" : "MMMM")
        return f.string(from: date(month + "-01"))
    }
    static func label(_ iso: String) -> String {
        if iso == today { return "Today" }
        if iso == add(-1, to: today) { return "Yesterday" }
        let f = DateFormatter()
        f.setLocalizedDateFormatFromTemplate(iso.prefix(4) == today.prefix(4) ? "EEE d MMM" : "d MMM y")
        return f.string(from: date(iso))
    }
    static func short(_ iso: String) -> String {
        let f = DateFormatter()
        f.setLocalizedDateFormatFromTemplate("d MMM")
        return f.string(from: date(iso))
    }
}

enum Money {
    private static var cache: [String: NumberFormatter] = [:]

    private static func formatter(_ currency: String, decimals: Int, compact: Bool) -> NumberFormatter {
        let key = "\(currency)\(decimals)\(compact)"
        if let f = cache[key] { return f }
        let f = NumberFormatter()
        f.numberStyle = .currency
        f.currencyCode = currency
        // Narrow symbols ($ rather than US$, ₦ rather than NGN).
        if let symbol = symbols[currency] { f.currencySymbol = symbol }
        f.maximumFractionDigits = decimals
        f.minimumFractionDigits = 0
        cache[key] = f
        return f
    }
    private static let symbols: [String: String] = [
        "NGN": "₦", "USD": "$", "EUR": "€", "GBP": "£", "CAD": "$", "AUD": "$", "KES": "KSh", "GHS": "₵", "ZAR": "R",
        "INR": "₹", "JPY": "¥", "BRL": "R$", "MXN": "$", "AED": "AED ", "EGP": "E£",
    ]
    static func symbol(_ currency: String) -> String { symbols[currency] ?? currency }

    /// "$1,300", "$7.14", "₦45K" (compact), "+$20" (sign).
    static func format(_ n: Double, _ currency: String, compact: Bool = false, sign: Bool = false) -> String {
        let a = abs(n)
        let prefix = n < 0 ? "−" : (sign && n > 0 ? "+" : "")
        if compact && a >= 10_000 {
            let (v, s): (Double, String) = a >= 1e9 ? (a / 1e9, "B") : a >= 1e6 ? (a / 1e6, "M") : (a / 1e3, "K")
            let num = v >= 100 ? String(format: "%.0f", v) : String(format: "%.1f", v).replacingOccurrences(of: ".0", with: "")
            return prefix + symbol(currency) + num + s
        }
        let decimals = a < 100 && a.truncatingRemainder(dividingBy: 1) != 0 ? 2 : 0
        let s = formatter(currency, decimals: decimals, compact: compact).string(from: NSNumber(value: a)) ?? "\(a)"
        return prefix + s
    }

    static let currencies: [(code: String, name: String, flag: String)] = [
        ("NGN", "Nigerian Naira", "🇳🇬"), ("USD", "US Dollar", "🇺🇸"), ("EUR", "Euro", "🇪🇺"), ("GBP", "British Pound", "🇬🇧"),
        ("CAD", "Canadian Dollar", "🇨🇦"), ("AUD", "Australian Dollar", "🇦🇺"), ("KES", "Kenyan Shilling", "🇰🇪"),
        ("GHS", "Ghanaian Cedi", "🇬🇭"), ("ZAR", "South African Rand", "🇿🇦"), ("INR", "Indian Rupee", "🇮🇳"),
        ("JPY", "Japanese Yen", "🇯🇵"), ("BRL", "Brazilian Real", "🇧🇷"), ("MXN", "Mexican Peso", "🇲🇽"),
        ("AED", "UAE Dirham", "🇦🇪"), ("EGP", "Egyptian Pound", "🇪🇬"),
    ]
    static func guessCurrency() -> String {
        let code = Locale.current.currency?.identifier ?? "USD"
        return currencies.contains { $0.code == code } ? code : "USD"
    }
}

/// Small regex helper (NSRegularExpression), so the parser reads like the web one.
struct RX {
    let re: NSRegularExpression
    init(_ pattern: String, _ options: NSRegularExpression.Options = [.caseInsensitive]) {
        // Patterns are constants written here; a typo should fail loudly in development.
        re = try! NSRegularExpression(pattern: pattern, options: options)
    }
    func test(_ s: String) -> Bool {
        re.firstMatch(in: s, range: NSRange(s.startIndex..., in: s)) != nil
    }
    func matches(_ s: String) -> [NSTextCheckingResult] {
        re.matches(in: s, range: NSRange(s.startIndex..., in: s))
    }
    func firstGroups(_ s: String) -> [String?]? {
        guard let m = re.firstMatch(in: s, range: NSRange(s.startIndex..., in: s)) else { return nil }
        return (0..<m.numberOfRanges).map { i in Range(m.range(at: i), in: s).map { String(s[$0]) } }
    }
    func replace(_ s: String, with t: String) -> String {
        re.stringByReplacingMatches(in: s, range: NSRange(s.startIndex..., in: s), withTemplate: t)
    }
}
