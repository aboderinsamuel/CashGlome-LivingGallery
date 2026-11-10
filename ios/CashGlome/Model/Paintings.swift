import SwiftUI

/// The collection: public-domain paintings (Wikimedia Commons), the same ones the desktop app restores.
struct Painting: Identifiable, Hashable {
    let id: String
    let title: String
    let artist: String
    let year: String
    let line: String
    /// Where the eye should land when the painting is cropped (0…1).
    let focus: UnitPoint

    var image: Image { Image("painting-\(id)") }
}

enum Paintings {
    static let all: [String: Painting] = [
        "moneylender": .init(id: "moneylender", title: "The Moneylender and His Wife", artist: "Quentin Matsys", year: "1514", line: "Every coin weighed, every page read.", focus: UnitPoint(x: 0.45, y: 0.72)),
        "wedding": .init(id: "wedding", title: "The Peasant Wedding", artist: "Pieter Bruegel the Elder", year: "1567", line: "A table that never seems to empty.", focus: UnitPoint(x: 0.5, y: 0.62)),
        "icarus": .init(id: "icarus", title: "Landscape with the Fall of Icarus", artist: "after Pieter Bruegel the Elder", year: "c. 1560", line: "Flying close to the sun, while the ploughman keeps ploughing.", focus: UnitPoint(x: 0.7, y: 0.7)),
        "cardsharps": .init(id: "cardsharps", title: "The Cardsharps", artist: "Caravaggio", year: "c. 1594", line: "The dice are always on the table.", focus: UnitPoint(x: 0.3, y: 0.55)),
        "athens": .init(id: "athens", title: "The School of Athens", artist: "Raphael", year: "1511", line: "Spending on what you know.", focus: UnitPoint(x: 0.5, y: 0.45)),
        "hunters": .init(id: "hunters", title: "The Hunters in the Snow", artist: "Pieter Bruegel the Elder", year: "1565", line: "Out in the cold, going somewhere.", focus: UnitPoint(x: 0.5, y: 0.55)),
        "harvesters": .init(id: "harvesters", title: "The Harvesters", artist: "Pieter Bruegel the Elder", year: "1565", line: "What you sowed, brought in.", focus: UnitPoint(x: 0.45, y: 0.6)),
        "gisze": .init(id: "gisze", title: "The Merchant Georg Gisze", artist: "Hans Holbein the Younger", year: "1532", line: "A room full of fine things, each one chosen.", focus: UnitPoint(x: 0.5, y: 0.4)),
        "goldsmith": .init(id: "goldsmith", title: "A Goldsmith in His Shop", artist: "Petrus Christus", year: "1449", line: "Rings weighed on the counter.", focus: UnitPoint(x: 0.5, y: 0.55)),
        "babel": .init(id: "babel", title: "The Tower of Babel", artist: "Pieter Bruegel the Elder", year: "c. 1568", line: "Built one level at a time.", focus: UnitPoint(x: 0.5, y: 0.45)),
        "carnival": .init(id: "carnival", title: "The Fight Between Carnival and Lent", artist: "Pieter Bruegel the Elder", year: "1559", line: "Feast on one side, restraint on the other.", focus: UnitPoint(x: 0.5, y: 0.6)),
        "magi": .init(id: "magi", title: "Adoration of the Magi", artist: "Sandro Botticelli", year: "c. 1475", line: "Everyone arrives carrying a gift.", focus: UnitPoint(x: 0.5, y: 0.55)),
        "matthew": .init(id: "matthew", title: "The Calling of Saint Matthew", artist: "Caravaggio", year: "1600", line: "The collector at his table, counting.", focus: UnitPoint(x: 0.35, y: 0.55)),
        "census": .init(id: "census", title: "The Census at Bethlehem", artist: "Pieter Bruegel the Elder", year: "1566", line: "Everyone on the move, everyone paying their dues.", focus: UnitPoint(x: 0.4, y: 0.6)),
        "arnolfini": .init(id: "arnolfini", title: "The Arnolfini Portrait", artist: "Jan van Eyck", year: "1434", line: "Home, kept carefully.", focus: UnitPoint(x: 0.5, y: 0.4)),
        "hare": .init(id: "hare", title: "Young Hare", artist: "Albrecht Dürer", year: "1502", line: "The first study, before the great works.", focus: UnitPoint(x: 0.5, y: 0.5)),
    ]

    /// Who you were this month, and the painting that goes with it.
    static func character(_ s: MonthStats) -> (name: String, line: String, painting: Painting) {
        func p(_ id: String) -> Painting { all[id] ?? all["moneylender"]! }
        guard s.entries.count >= 3 else { return ("The Beginner", "Every collection starts with one study.", p("hare")) }
        if s.moneyIn > 0 && s.putAside / s.moneyIn >= 0.2 { return ("The Saver", "Every coin weighed before it moves.", p("moneylender")) }
        if s.spend > s.moneyIn * 1.1 && s.moneyIn > 0 { return ("The Overreacher", "Flying a little close to the sun.", p("icarus")) }
        switch s.byCategory.first?.id ?? "" {
        case "rent", "bills": return ("The Homebody", "Home comes first, and it shows.", p("arnolfini"))
        case "dining", "fun": return ("The Host", "A full table, a good time.", p("wedding"))
        case "giving": return ("The Giver", "Generous to the people around you.", p("magi"))
        case "transport", "travel": return ("The Explorer", "Always on the way somewhere.", p("hunters"))
        case "shopping", "tech": return ("The Collector", "Fine things, each one chosen.", p("gisze"))
        case "subscriptions": return ("The Subscriber", "Small renewals, every month.", p("matthew"))
        case "betting": return ("The Risk Taker", "The dice are always on the table.", p("cardsharps"))
        case "education": return ("The Student", "Spending on what you know.", p("athens"))
        case "groceries": return ("The Provider", "What you sowed, brought in.", p("harvesters"))
        default: return ("The Steady Hand", "Built one level at a time.", p("babel"))
        }
    }
}
