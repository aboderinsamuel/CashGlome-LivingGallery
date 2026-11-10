import Foundation
import SwiftData

enum Direction: String, Codable, CaseIterable {
    case moneyIn = "in"
    case moneyOut = "out"
}

enum Feeling: String, Codable, CaseIterable {
    case joy, meh, regret

    var title: String {
        switch self {
        case .joy: return "Worth it"
        case .meh: return "Fine"
        case .regret: return "Would take back"
        }
    }
    var symbol: String {
        switch self {
        case .joy: return "heart.fill"
        case .meh: return "minus.circle"
        case .regret: return "arrow.uturn.backward.circle"
        }
    }
}

/// One thing that happened to your money. Stored on this device only (SwiftData).
@Model
final class Entry {
    @Attribute(.unique) var id: UUID
    /// What the person wrote, word for word.
    var text: String
    /// A short title ("Bolt to work").
    var label: String
    /// Always positive; `direction` says which way it went.
    var amount: Double
    var directionRaw: String
    var category: String
    var feelingRaw: String?
    /// The day it happened, as YYYY-MM-DD (time zones never move an entry to another day).
    var day: String
    var createdAt: Date
    /// "oracle" (read on the device), "muse" or "manual".
    var source: String

    init(id: UUID = UUID(), text: String, label: String, amount: Double, direction: Direction, category: String,
         feeling: Feeling? = nil, day: String, createdAt: Date = .now, source: String = "oracle") {
        self.id = id
        self.text = text
        self.label = label
        self.amount = amount
        self.directionRaw = direction.rawValue
        self.category = category
        self.feelingRaw = feeling?.rawValue
        self.day = day
        self.createdAt = createdAt
        self.source = source
    }

    var direction: Direction {
        get { Direction(rawValue: directionRaw) ?? .moneyOut }
        set { directionRaw = newValue.rawValue }
    }
    var feeling: Feeling? {
        get { feelingRaw.flatMap(Feeling.init(rawValue:)) }
        set { feelingRaw = newValue?.rawValue }
    }
    var isIn: Bool { direction == .moneyIn }
    var month: String { String(day.prefix(7)) }
    var date: Date { Day.date(day) }
    var cat: MoneyCategory { Categories.of(category) }
}

/// A reading of something typed, before it is saved.
struct Parsed: Identifiable, Equatable {
    let id = UUID()
    var amount: Double
    var direction: Direction
    var category: String
    var label: String
    var feeling: Feeling?
    var day: String
    var confidence: Double
    var text: String
    var source: String

    func makeEntry() -> Entry {
        Entry(text: text, label: label, amount: amount, direction: direction, category: category, feeling: feeling, day: day, source: source)
    }
}

/// Something you're saving for.
@Model
final class Goal {
    @Attribute(.unique) var id: UUID
    var name: String
    var amount: Double
    var symbol: String
    var createdAt: Date

    init(id: UUID = UUID(), name: String, amount: Double, symbol: String = "star.fill", createdAt: Date = .now) {
        self.id = id
        self.name = name
        self.amount = amount
        self.symbol = symbol
        self.createdAt = createdAt
    }
}
