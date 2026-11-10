import Foundation

/// Categories that learn. Correct one once ("Bolt" is getting around) and the same thing is filed the same way
/// from then on, whether Muse or the Oracle read it. Kept on this device.
enum Learned {
    private static let key = "cg-learned"
    private static let small: Set<String> = ["to", "the", "a", "an", "for", "at", "on", "in", "of", "and", "my", "from", "with", "x"]

    static func key(of label: String) -> String {
        let cleaned = RX(#"[^a-zÀ-ɏ ]+"#).replace(label.lowercased(), with: " ")
        return cleaned.split(separator: " ").map(String.init).filter { $0.count > 1 && !small.contains($0) }.prefix(2).joined(separator: " ")
    }
    private static var memory: [String: String] {
        get { UserDefaults.standard.dictionary(forKey: key) as? [String: String] ?? [:] }
        set { UserDefaults.standard.set(newValue, forKey: key) }
    }

    static func learn(label: String, category: String) {
        let k = key(of: label)
        guard !k.isEmpty else { return }
        var m = memory
        m[k] = category
        if let first = k.split(separator: " ").first.map(String.init), first != k { m[first] = category }
        memory = m
    }

    /// The remembered category, only if it points the same way (in or out).
    static func recall(_ p: Parsed) -> Parsed {
        let k = key(of: p.label)
        let m = memory
        guard let id = m[k] ?? k.split(separator: " ").first.flatMap({ m[String($0)] }),
              Categories.of(id).direction == p.direction else { return p }
        var q = p
        q.category = id
        return q
    }
}

/// Settings that aren't secret. The Muse key lives in the Keychain, never here.
final class AppSettings: ObservableObject {
    static let shared = AppSettings()
    private let d = UserDefaults.standard

    @Published var name: String { didSet { d.set(name, forKey: "name") } }
    @Published var currency: String { didSet { d.set(currency, forKey: "currency") } }
    @Published var onboarded: Bool { didSet { d.set(onboarded, forKey: "onboarded") } }
    @Published var museOn: Bool { didSet { d.set(museOn, forKey: "museOn") } }
    /// nil until the person decides whether questions may go to Muse.
    @Published var askMuse: Bool? { didSet { if let askMuse { d.set(askMuse, forKey: "askMuse") } else { d.removeObject(forKey: "askMuse") } } }
    @Published var parseModel: String { didSet { d.set(parseModel, forKey: "parseModel") } }
    @Published var askModel: String { didSet { d.set(askModel, forKey: "askModel") } }
    @Published var haptics: Bool { didSet { d.set(haptics, forKey: "haptics") } }
    @Published var hasKey: Bool

    private init() {
        name = d.string(forKey: "name") ?? ""
        currency = d.string(forKey: "currency") ?? Money.guessCurrency()
        onboarded = d.bool(forKey: "onboarded")
        museOn = d.object(forKey: "museOn") as? Bool ?? true
        askMuse = d.object(forKey: "askMuse") as? Bool
        parseModel = d.string(forKey: "parseModel") ?? "muse-spark-1.1"
        askModel = d.string(forKey: "askModel") ?? "muse-wonder-1.0"
        haptics = d.object(forKey: "haptics") as? Bool ?? true
        hasKey = !(Keychain.read("muse-key") ?? "").isEmpty
    }

    var museKey: String {
        get { Keychain.read("muse-key") ?? "" }
        set {
            let v = newValue.trimmingCharacters(in: .whitespacesAndNewlines)
            if v.isEmpty { Keychain.delete("muse-key") } else { Keychain.write("muse-key", v) }
            hasKey = !v.isEmpty
        }
    }
    /// Muse is used only with a key and while it's switched on.
    var museReady: Bool { museOn && hasKey }

    static let models: [(id: String, name: String, note: String)] = [
        ("muse-spark-1.1", "Muse Spark 1.1", "Fast. Good for reading entries."),
        ("muse-spark-1.3", "Muse Spark 1.3", "Newest Spark."),
        ("muse-wonder-1.0", "Muse Wonder 1.0", "Most careful. Best for questions."),
    ]
}
