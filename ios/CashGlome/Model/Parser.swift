import Foundation

/// The Oracle: reads "bolt 6k, data 3k, got paid 350k" on the device, instantly, with no network.
/// A port of the desktop app's parser, so both read the same sentence the same way.
enum Oracle {
    private static let mult: [String: Double] = ["k": 1e3, "m": 1e6, "b": 1e9, "thousand": 1e3, "grand": 1e3, "million": 1e6, "mil": 1e6, "billion": 1e9, "bn": 1e9]

    private static let amountRE = RX(#"(?<cur>[₦$€£¥₹]|ngn|usd|eur|gbp|ksh|kes|ghs|zar|inr|n(?=\d))?\s?(?<num>\d{1,3}(?:[,\s]\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)\s?(?<mult>k|m|b|bn|thousand|grand|million|mil|billion)?(?![a-zA-Z])"#)
    private static let notMoneyAfter = RX(#"^\s*(days?|weeks?|months?|years?|hrs?|hours?|mins?|minutes?|times?|x\b|pcs|pieces|people|plates?|bottles?|packs?|kg|g\b|liters?|litres?|am\b|pm\b|st\b|nd\b|rd\b|th\b|%)"#)

    private static let paidIn = RX(#"\b(got|get|been|was|just got) paid\b|\bpaid me\b|\bsent me\b|\bgave me\b|\btransferred to me\b"#)
    private static let inRE = RX(#"\b(got paid|get paid|been paid|got|get|received|recieved|receive|earned|earn|paid me|pay me|sent me|send me|gave me|give me|transferred to me|credited|credit alert|salary|payday|income|refund(ed)?|reversal|sold|profit|allowance|bonus|won|winnings|payout|dividends?|interest|commission|cashback|came in|made|brand deal|invoice paid|client paid|blessed me|dashed me|sprayed me)\b"#)
    private static let outRE = RX(#"\b(spent|spend|spending|bought|buy|buying|paid|pay|paying|sent|send|gave|give|transfer(red)?( to)?|subscribed|subscription|lost|debited|debit alert|ordered|order for|booked|renewed|tipped|donated|for|on)\b"#)
    private static let strongOut = RX(#"\b(spent|bought|paid for|paid|debited|ordered|lost)\b"#)
    private static let joyRE = RX(#"(\bworth it\b|\bloved\b|\blove it\b|\bhappy\b|\bamazing\b|\bbest\b|❤️|😍|🥰|🔥|\benjoyed\b|\btreat(ed)? myself\b|\bno regrets?\b)"#)
    private static let regretRE = RX(#"(\bregret(ted|ting)?\b|\bwasted?\b|\bshouldn'?t have\b|\bunnecessary\b|\bimpulse\b|\bdumb\b|\bstupid\b|😩|😭|🤦|\bugh\b|\bscam(med)?\b|\boverpriced\b|\bwhy did i\b)"#)

    struct Hit { let value: Double; let range: Range<String.Index>; let strong: Bool }

    static func amounts(_ text: String) -> [Hit] {
        var hits: [Hit] = []
        for m in amountRE.matches(text) {
            guard let whole = Range(m.range, in: text), let numR = Range(m.range(withName: "num"), in: text) else { continue }
            let multR = Range(m.range(withName: "mult"), in: text)
            let curR = Range(m.range(withName: "cur"), in: text)
            if multR == nil && notMoneyAfter.test(String(text[whole.upperBound...])) { continue }
            let raw = text[numR].replacingOccurrences(of: ",", with: "").replacingOccurrences(of: " ", with: "")
            guard var v = Double(raw), v.isFinite else { continue }
            if let multR { v *= mult[text[multR].lowercased()] ?? 1 }
            hits.append(Hit(value: v, range: whole, strong: curR != nil || multR != nil || text[numR].contains(",")))
        }
        return hits
    }

    /* Spoken numbers: "four thousand five hundred" → "4500", so dictated entries read like typed ones. */
    private static let units: [String: Double] = ["zero": 0, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10, "eleven": 11, "twelve": 12, "thirteen": 13, "fourteen": 14, "fifteen": 15, "sixteen": 16, "seventeen": 17, "eighteen": 18, "nineteen": 19]
    private static let tens: [String: Double] = ["twenty": 20, "thirty": 30, "forty": 40, "fourty": 40, "fifty": 50, "sixty": 60, "seventy": 70, "eighty": 80, "ninety": 90]
    private static let scales: [String: Double] = ["hundred": 100, "thousand": 1e3, "million": 1e6, "billion": 1e9]
    private static let numWord: RX = {
        let w = (Array(units.keys) + Array(tens.keys) + Array(scales.keys)).joined(separator: "|")
        return RX(#"\b(?:(?:a|an|and|"# + w + #")[\s-]+)*(?:"# + w + #")\b"#)
    }()

    static func spokenToDigits(_ text: String) -> String {
        var out = text
        for m in numWord.matches(text).reversed() {
            guard let r = Range(m.range, in: text) else { continue }
            let phrase = String(text[r])
            let words = phrase.lowercased().split(whereSeparator: { $0 == " " || $0 == "-" }).map(String.init).filter { $0 != "and" }
            var total = 0.0, cur = 0.0, scaled = false, any = false
            var bail = false
            for (i, w) in words.enumerated() {
                if (w == "a" || w == "an") && i + 1 < words.count && scales[words[i + 1]] != nil { cur = 1; continue }
                if w == "a" || w == "an" { bail = true; break }
                if let u = units[w] { cur += u; any = true }
                else if let t = tens[w] { cur += t; any = true }
                else if w == "hundred" { cur = (cur == 0 ? 1 : cur) * 100; scaled = true; any = true }
                else if let s = scales[w] { total += (cur == 0 ? 1 : cur) * s; cur = 0; scaled = true; any = true }
            }
            let value = total + cur
            if bail || !any || (!scaled && value < 20) { continue }
            let digits = value.truncatingRemainder(dividingBy: 1) == 0 ? String(Int(value)) : String(value)
            if let outR = Range(m.range, in: out) { out.replaceSubrange(outR, with: digits) }
        }
        return out
    }

    static func parseDay(_ text: String, today: String = Day.today) -> String {
        let t = text.lowercased()
        if RX(#"\byesterday\b|\blast night\b"#).test(t) { return Day.add(-1, to: today) }
        if let g = RX(#"\b(\d+|a|one|two|three|four|five|six)\s+(day|days|week|weeks)\s+ago\b"#).firstGroups(t), let nRaw = g[1], let unit = g[2] {
            let words = ["a": 1, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6]
            let n = words[nRaw] ?? Int(nRaw) ?? 1
            return Day.add(-n * (unit.hasPrefix("week") ? 7 : 1), to: today)
        }
        if RX(#"\blast week\b"#).test(t) { return Day.add(-7, to: today) }
        let names = Day.weekdayNames.map { $0.lowercased() }
        if let wd = names.firstIndex(where: { RX(#"\b(on |last )?"# + $0 + #"\b"#).test(t) }) {
            var diff = (Day.weekday(today) - wd + 7) % 7
            if diff == 0 && t.contains("last") { diff = 7 }
            return Day.add(-diff, to: today)
        }
        return today
    }

    private static func scoreCategory(_ text: String, _ dir: Direction) -> (id: String, score: Double) {
        let cleaned = RX(#"[^\p{L}\p{N}&'\s]"#).replace(text.lowercased(), with: " ")
        let t = " " + cleaned + " "
        var best: (id: String, score: Double) = (dir == .moneyIn ? "windfall" : "other", 0)
        for c in Categories.all where c.direction == dir {
            var s = 0.0
            for w in c.words where t.contains(" " + w + " ") || t.contains(" " + w + "s ") { s += 1 + Double(w.count) / 8 }
            if s > best.score { best = (c.id, s) }
        }
        if dir == .moneyIn && best.score == 0 && RX(#"\b(got paid|paid me|pay ?day|earned)\b"#).test(t) {
            best = (RX(#"\bfor\b"#).test(t) ? "craft" : "salary", 0.5)
        }
        return best
    }

    private static let filler = RX(#"^(i\s+)?(just\s+)?(spent|spend|bought|buy|paid|pay|got|get|received|recieved|earned|made|sent|gave|ordered|booked|renewed|subscribed to|transferred)\b\s*"#)

    private static func makeLabel(_ text: String, _ hits: [Hit]) -> String {
        var s = text
        for h in hits.sorted(by: { $0.range.lowerBound > $1.range.lowerBound }) { s.replaceSubrange(h.range, with: " ") }
        s = RX(#"\b(naira|dollars?|bucks|pounds?|euros?|cedis?|rand|shillings?|rupees?|yen)\b"#).replace(s, with: " ")
        s = RX(#"\b(yesterday|today|last night|this morning|tonight|last week|\d+ days? ago)\b"#).replace(s, with: " ")
        s = RX(#"[—–-]\s*(regret.*|worth it.*|loved it.*)$"#).replace(s, with: " ")
        s = RX(#"\b(worth it|no regrets?|regret(ted)?|loved it|ugh)\b"#).replace(s, with: " ")
        s = RX(#"\s+"#).replace(s, with: " ").trimmingCharacters(in: .whitespaces)
        for _ in 0..<3 {
            s = filler.replace(s, with: "")
            s = RX(#"^(on|for|from|to|the|a|an|my|me|in)\s+"#).replace(s, with: "").trimmingCharacters(in: .whitespaces)
        }
        s = RX(#"[,.;:!—–\-\s]+$"#).replace(s, with: "")
        s = RX(#"\s+(for|on|to|from|at|with|of|in|by|me)$"#).replace(s, with: "").trimmingCharacters(in: .whitespaces)
        guard !s.isEmpty else { return "" }
        if s.count > 46 { s = String(s.prefix(44)).trimmingCharacters(in: .whitespaces) + "…" }
        return s.prefix(1).uppercased() + s.dropFirst()
    }

    static func parseOne(_ input: String, today: String = Day.today) -> Parsed? {
        let raw = spokenToDigits(input.trimmingCharacters(in: .whitespacesAndNewlines))
        guard !raw.isEmpty else { return nil }
        let hits = amounts(raw)
        guard !hits.isEmpty else { return nil }
        let pick = hits.first(where: { $0.strong }) ?? hits.max(by: { $0.value < $1.value })!

        let inHit = inRE.test(raw)
        let outHit = outRE.test(raw)
        let strong = strongOut.test(paidIn.replace(raw, with: " "))
        var dir: Direction = .moneyOut
        var confidence = 0.55
        if inHit && !strong { dir = .moneyIn; confidence = 0.8 }
        else if strong || outHit { dir = .moneyOut; confidence = 0.8 }
        if RX(#"\b(lost|loss)\b.*\b(bet|stake)"#).test(raw) { dir = .moneyOut }
        if RX(#"\b(won|winnings)\b"#).test(raw) { dir = .moneyIn }

        var best = scoreCategory(raw, dir)
        if confidence < 0.7 {
            let flipped: Direction = dir == .moneyIn ? .moneyOut : .moneyIn
            let other = scoreCategory(raw, flipped)
            if other.score > best.score { dir = flipped; best = other }
        }
        if best.score > 0 { confidence = min(0.95, confidence + 0.12) }

        var feeling: Feeling?
        if regretRE.test(raw) { feeling = .regret } else if joyRE.test(raw) { feeling = .joy }

        let label = makeLabel(raw, hits)
        return Parsed(amount: (pick.value * 100).rounded() / 100, direction: dir, category: best.id,
                      label: label.isEmpty ? Categories.of(best.id).name : label, feeling: feeling,
                      day: parseDay(raw, today: today), confidence: confidence, text: raw, source: "oracle")
    }

    /// "bolt 6k, data 3k and lunch 4500" → three pieces.
    static func split(_ text: String) -> [String] {
        let lines = spokenToDigits(text).components(separatedBy: CharacterSet(charactersIn: "\n;"))
            .map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
        let splitter = RX(#",\s+|\.\s+|\s+(?:and then|then|also|plus|and)\s+(?=\D*\d)"#)
        var out: [String] = []
        for line in lines {
            let parts = splitter.replace(line, with: "\u{1F}").components(separatedBy: "\u{1F}")
                .map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
            let withMoney = parts.filter { !amounts($0).isEmpty }
            if withMoney.count > 1 {
                var carry = ""
                for p in parts {
                    if !amounts(p).isEmpty { out.append((carry + " " + p).trimmingCharacters(in: .whitespaces)); carry = "" }
                    else { carry += " " + p }
                }
            } else { out.append(line) }
        }
        return out
    }

    static func parse(_ text: String) -> [Parsed] { split(text).compactMap { parseOne($0) } }

    /// "how much did I spend on food?" is a question, not an entry.
    static func isQuestion(_ text: String) -> Bool {
        let s = text.trimmingCharacters(in: .whitespaces)
        return s.count > 3 && (s.hasSuffix("?") || RX(#"^(how|what|what's|whats|when|where|why|which|who|did|do|does|am|is|are|was|were|can|could|should|will|would|have|has|show|compare|tell|list|give)\b"#).test(s))
    }
}
