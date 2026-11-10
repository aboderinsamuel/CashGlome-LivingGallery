import Foundation
import SwiftData

/// An example two months, so the app can be tried before writing anything real. Clearly marked "example".
enum Demo {
    static func fill(_ context: ModelContext, currency: String) {
        // Amounts are written in US dollars and scaled to the chosen currency, so the example feels local.
        let scale: Double = ["NGN": 1500, "KES": 130, "GHS": 15, "ZAR": 18, "INR": 84, "JPY": 150, "BRL": 5.5, "MXN": 18, "AED": 3.67, "EGP": 49, "EUR": 0.92, "GBP": 0.78, "CAD": 1.37, "AUD": 1.5][currency] ?? 1
        let thisMonth = Day.thisMonth, lastMonth = Day.shiftMonth(thisMonth, -1)
        let todayDay = Int(Day.today.suffix(2)) ?? 28

        // (day of month, text, amount, category, in?, feeling)
        let pattern: [(Int, String, Double, String, Bool, Feeling?)] = [
            (1, "Rent share", 1300, "rent", false, nil), (1, "Moved to savings", 165, "savings", false, nil),
            (1, "Salary", 2900, "salary", true, nil), (2, "Gift for mom", 59.65, "giving", false, .joy),
            (2, "Metro card", 2.96, "transport", false, nil), (3, "Oat latte", 7.14, "dining", false, nil),
            (3, "Trader Joe's run", 81.5, "groceries", false, nil), (4, "Netflix", 17.19, "subscriptions", false, nil),
            (5, "Metro card", 2.96, "transport", false, nil), (5, "Phone bill", 46.92, "bills", false, nil),
            (6, "Gym day pass", 22.17, "selfcare", false, nil), (7, "Sushi with friends", 46.41, "dining", false, .joy),
            (8, "Amazon impulse buy", 39.87, "shopping", false, .regret), (8, "Spotify", 10.53, "subscriptions", false, nil),
            (9, "ChatGPT Plus", 23.35, "subscriptions", false, nil), (9, "Metro card", 2.96, "transport", false, nil),
            (10, "New sneakers", 112, "shopping", false, .joy), (11, "Logo design for a client", 420, "craft", true, nil),
            (12, "Lunch", 14.2, "dining", false, nil), (13, "Concert tickets", 212, "fun", false, .joy),
            (14, "Electricity", 38, "bills", false, nil), (15, "Groceries", 64.3, "groceries", false, nil),
            (16, "Uber home", 18.4, "transport", false, nil), (17, "Gift for mom", 54.75, "giving", false, .joy),
            (18, "Dinner out", 58.9, "dining", false, nil), (19, "Haircut", 29.54, "selfcare", false, nil),
            (20, "Book", 16.99, "education", false, nil), (21, "Brunch", 32.5, "dining", false, nil),
            (22, "Sold old camera", 150, "trade", true, nil), (23, "Groceries", 47.1, "groceries", false, nil),
            (24, "Takeout", 26.8, "dining", false, .regret), (25, "Movie night", 24, "fun", false, nil),
            (26, "Moved to savings", 100, "savings", false, nil), (27, "Pharmacy", 12.6, "health", false, nil),
            (28, "Coffee", 5.4, "dining", false, nil),
        ]
        for (month, upTo) in [(lastMonth, 31), (thisMonth, todayDay)] {
            let days = Day.daysIn(month)
            for (d, label, usd, cat, isIn, feeling) in pattern where d <= min(upTo, days) {
                let day = month + String(format: "-%02d", d)
                // A little variation between the two months.
                let wobble = month == thisMonth ? 1.0 : (cat == "rent" || cat == "subscriptions" || cat == "salary" ? 1.0 : 1.18)
                let amount = (usd * scale * wobble * 100).rounded() / 100
                context.insert(Entry(text: "\(label) \(amount)", label: label, amount: amount, direction: isIn ? .moneyIn : .moneyOut,
                                     category: cat, feeling: feeling, day: day, source: "manual"))
            }
        }
        try? context.save()
    }
}
