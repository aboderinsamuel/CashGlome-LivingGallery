import Foundation

/// Meta Muse (Meta Model API, OpenAI-compatible Chat Completions). Called straight from the phone with the
/// person's own key. Nothing is sent unless Muse is switched on, and Ask asks first.
enum Muse {
    static let base = URL(string: "https://api.meta.ai/v1/chat/completions")!

    struct Failure: LocalizedError {
        let message: String
        var errorDescription: String? { message }
    }

    struct ToolCall { let id: String; let name: String; let arguments: String }
    struct Reply { let content: String; let toolCalls: [ToolCall]; let raw: [String: Any] }

    /// Muse models think before they answer, and that counts against max_tokens: ask for light thinking
    /// and leave room for it, or a long think can use the whole budget and return nothing.
    private static let thinkingRoom = 1500

    static func send(model: String, messages: [[String: Any]], tools: [[String: Any]]? = nil,
                     maxTokens: Int = 900, temperature: Double = 0.2, timeout: TimeInterval = 30) async throws -> Reply {
        let key = AppSettings.shared.museKey
        guard !key.isEmpty else { throw Failure(message: "Add your Meta key in Settings to use Muse.") }
        var body: [String: Any] = ["model": model, "messages": messages, "temperature": temperature,
                                   "max_tokens": maxTokens + thinkingRoom, "reasoning_effort": "low"]
        if let tools, !tools.isEmpty { body["tools"] = tools; body["tool_choice"] = "auto" }

        var req = URLRequest(url: base, timeoutInterval: timeout)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("Bearer \(key)", forHTTPHeaderField: "Authorization")
        req.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: req)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else {
            let text = String(data: data, encoding: .utf8) ?? ""
            if status == 401 || status == 403 { throw Failure(message: "Meta didn't accept the key. Check it in Settings.") }
            throw Failure(message: "Muse error \(status): \(text.prefix(140))")
        }
        guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let choices = json["choices"] as? [[String: Any]],
              let message = choices.first?["message"] as? [String: Any] else {
            throw Failure(message: "Muse sent back something unexpected.")
        }
        let calls = (message["tool_calls"] as? [[String: Any]] ?? []).compactMap { c -> ToolCall? in
            guard let id = c["id"] as? String, let f = c["function"] as? [String: Any], let name = f["name"] as? String else { return nil }
            return ToolCall(id: id, name: name, arguments: f["arguments"] as? String ?? "{}")
        }
        return Reply(content: message["content"] as? String ?? "", toolCalls: calls, raw: message)
    }

    static func test() async throws -> String {
        let r = try await send(model: AppSettings.shared.parseModel, messages: [["role": "user", "content": "Reply with exactly: CashGlome online"]], maxTokens: 20, timeout: 15)
        return r.content.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// Reads casual writing ("bolt 6k, data 3k, mum sent 20k") into entries. Falls back to the Oracle on any failure.
    static func read(_ text: String, currency: String) async -> (items: [Parsed], byMuse: Bool, error: String?) {
        let settings = AppSettings.shared
        guard settings.museReady else { return (Oracle.parse(text).map(Learned.recall), false, nil) }
        let cats = Categories.all.map { "\($0.id) (\($0.direction == .moneyIn ? "INFLOW" : "OUTFLOW"): \($0.name))" }.joined(separator: "\n")
        let system = """
        You are the money-reading engine of CashGlome, a personal finance app. The user describes money that came IN or went OUT in casual language, slang, pidgin, emojis or several items in one sentence.
        Today is \(Day.today). Currency: \(currency). "k" = thousand, "m" = million.
        Return ONLY JSON: {"items":[{"amount":number,"dir":"in"|"out","category":string,"label":string,"feeling":"joy"|"meh"|"regret"|null,"date":"YYYY-MM-DD","confidence":0..1}]}
        Rules: one item per distinct money movement. "dir" is "in" when the user received money, "out" when they spent, paid, gave, saved or invested it. Saving or investing is "out" with category "savings". label is a short 2-5 word title in the user's words. feeling only when the user expresses it. Resolve relative dates. Pick category ids ONLY from:
        \(cats)
        """
        do {
            let r = try await send(model: settings.parseModel, messages: [["role": "system", "content": system], ["role": "user", "content": text]], maxTokens: 700, temperature: 0, timeout: 20)
            let items = try decodeItems(r.content, text: text)
            guard !items.isEmpty else { throw Failure(message: "Muse found no money in that") }
            return (items.map(Learned.recall), true, nil)
        } catch {
            return (Oracle.parse(text).map(Learned.recall), false, error.localizedDescription)
        }
    }

    private static func decodeItems(_ content: String, text: String) throws -> [Parsed] {
        let cleaned = content.replacingOccurrences(of: "```json", with: "").replacingOccurrences(of: "```", with: "")
        guard let start = cleaned.firstIndex(where: { $0 == "{" || $0 == "[" }),
              let end = cleaned.lastIndex(where: { $0 == "}" || $0 == "]" }), start < end,
              let data = String(cleaned[start...end]).data(using: .utf8) else { throw Failure(message: "No JSON in Muse's answer") }
        let json = try JSONSerialization.jsonObject(with: data)
        let list = (json as? [String: Any])?["items"] as? [[String: Any]] ?? json as? [[String: Any]] ?? []
        return list.compactMap { it in
            let amount = (it["amount"] as? NSNumber)?.doubleValue ?? Double("\(it["amount"] ?? "")") ?? 0
            guard amount > 0, amount.isFinite else { return nil }
            let dir: Direction = (it["dir"] as? String) == "in" ? .moneyIn : .moneyOut
            var cat = it["category"] as? String ?? ""
            if Categories.all.first(where: { $0.id == cat && $0.direction == dir }) == nil { cat = dir == .moneyIn ? "windfall" : "other" }
            let date = it["date"] as? String ?? ""
            let day = RX(#"^\d{4}-\d{2}-\d{2}$"#).test(date) ? date : Day.today
            let label = String((it["label"] as? String ?? "").prefix(48))
            return Parsed(amount: amount, direction: dir, category: cat, label: label.isEmpty ? "Entry" : label,
                          feeling: (it["feeling"] as? String).flatMap(Feeling.init(rawValue:)), day: day,
                          confidence: (it["confidence"] as? NSNumber)?.doubleValue ?? 0.9, text: text, source: "muse")
        }
    }
}
