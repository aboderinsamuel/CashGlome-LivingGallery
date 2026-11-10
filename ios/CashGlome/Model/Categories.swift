import SwiftUI

enum Nature: String { case need, want, save, give, income }

struct MoneyCategory: Identifiable, Hashable {
    let id: String
    let name: String
    let short: String
    let hex: UInt32
    let direction: Direction
    let nature: Nature
    let symbol: String
    let words: [String]

    var color: Color { Color(hex: hex) }
}

/// The same categories as the desktop and web app, so entries mean the same thing everywhere.
enum Categories {
    static let all: [MoneyCategory] = [
        .init(id: "dining", name: "Eating out", short: "Food out", hex: 0xD9472B, direction: .moneyOut, nature: .want, symbol: "fork.knife",
              words: ["suya","shawarma","kfc","chicken","pizza","burger","restaurant","eat","ate","lunch","dinner","breakfast","snack","snacks","coffee","starbucks","latte","drinks","drink","bar","beer","wine","jollof","small chops","chops","puff","ice cream","dessert","takeout","takeaway","food","chowdeck","glovo","ubereats","uber eats","doordash","bole","amala","noodles","sushi","cafe","boba","mcdonald","mcdonalds","domino","dominos","chicken republic","cake","smoothie","juice","pepper soup","asun","zobo","chapman"]),
        .init(id: "groceries", name: "Groceries", short: "Groceries", hex: 0xA3AC7E, direction: .moneyOut, nature: .need, symbol: "basket.fill",
              words: ["groceries","grocery","market","supermarket","shoprite","foodstuff","rice","beans","yam","garri","bread","eggs","milk","oil","tomatoes","pepper","onions","vegetables","fruits","meat","fish","provisions","spar","walmart","costco","aldi","tesco","lidl","whole foods","trader joe","indomie","cereal"]),
        .init(id: "transport", name: "Getting around", short: "Transport", hex: 0xE9C75B, direction: .moneyOut, nature: .need, symbol: "car.fill",
              words: ["uber","bolt","taxi","cab","bus","brt","danfo","keke","okada","fuel","petrol","gas station","diesel","train","metro","subway","transport","fare","ride","lyft","parking","toll","car wash","mechanic","car repair","indrive","tube","ferry"]),
        .init(id: "travel", name: "Travel", short: "Travel", hex: 0x98AADE, direction: .moneyOut, nature: .want, symbol: "airplane",
              words: ["flight","airline","plane ticket","hotel","airbnb","vacation","holiday","trip","visa","passport","resort","booking","travel"]),
        .init(id: "bills", name: "Bills & utilities", short: "Bills", hex: 0xE8DCC0, direction: .moneyOut, nature: .need, symbol: "lightbulb.fill",
              words: ["electricity","nepa","phcn","prepaid","light bill","power","water bill","water","internet","wifi","data","airtime","recharge","phone bill","utility","utilities","bill","bills","gas bill","waste","trash","tv license","cable","router","mtn","glo","airtel","9mobile","spectranet","starlink"]),
        .init(id: "rent", name: "Home & rent", short: "Home", hex: 0xE2B2A2, direction: .moneyOut, nature: .need, symbol: "house.fill",
              words: ["rent","landlord","apartment","house rent","mortgage","service charge","caution fee","agent fee","furniture","home","repairs","plumber","electrician","cleaning","maid","housekeeping","decor"]),
        .init(id: "subscriptions", name: "Subscriptions", short: "Subscriptions", hex: 0xB9505C, direction: .moneyOut, nature: .want, symbol: "play.rectangle.fill",
              words: ["netflix","spotify","apple music","youtube premium","chatgpt","claude","icloud","prime","amazon prime","subscription","showmax","dstv","gotv","hulu","disney","hbo","max","canva","adobe","notion","figma","patreon","xbox game pass","playstation plus","ps plus","audible","duolingo","gym membership","membership","renewal","premium"]),
        .init(id: "shopping", name: "Shopping", short: "Shopping", hex: 0x8E2A2E, direction: .moneyOut, nature: .want, symbol: "bag.fill",
              words: ["clothes","clothing","shoes","sneakers","bag","dress","shirt","jeans","trousers","outfit","watch","jewelry","jewellery","amazon","jumia","shein","temu","zara","h&m","nike","adidas","perfume","cologne","fashion","aso ebi","ankara","agbada","hoodie","cap","shopping","mall","asos","etsy"]),
        .init(id: "tech", name: "Gadgets", short: "Gadgets", hex: 0x2A2620, direction: .moneyOut, nature: .want, symbol: "iphone",
              words: ["phone","iphone","samsung","laptop","macbook","airpods","headphones","earbuds","charger","gadget","ipad","tablet","camera","mic","microphone","ring light","keyboard","mouse","monitor","console","ps5","xbox","switch","software","app","power bank","screen","cable","gpu"]),
        .init(id: "fun", name: "Going out", short: "Going out", hex: 0xD98BA0, direction: .moneyOut, nature: .want, symbol: "ticket.fill",
              words: ["movie","movies","cinema","party","club","clubbing","concert","show","event","ticket","tickets","games","game","bowling","arcade","festival","outing","hangout","vibes","karaoke","museum","beach","owambe","turn up","lounge","hookah","shisha"]),
        .init(id: "betting", name: "Betting", short: "Betting", hex: 0x1E1B16, direction: .moneyOut, nature: .want, symbol: "dice.fill",
              words: ["bet","betting","sportybet","bet9ja","1xbet","betway","betking","casino","lottery","lotto","slots","stake","poker","gamble","aviator","parlay"]),
        .init(id: "health", name: "Health", short: "Health", hex: 0xA9CDA0, direction: .moneyOut, nature: .need, symbol: "cross.case.fill",
              words: ["hospital","doctor","clinic","drugs","medicine","pharmacy","malaria","test","lab","dentist","dental","glasses","therapy","therapist","health","insurance","hmo","vitamins","checkup","surgery","prescription"]),
        .init(id: "selfcare", name: "Self-care", short: "Self-care", hex: 0xEBC3B0, direction: .moneyOut, nature: .want, symbol: "sparkles",
              words: ["salon","hair","barber","haircut","braids","wig","nails","makeup","skincare","lashes","spa","massage","gym","fitness","pedicure","manicure","facial","lotion","cream","fragrance","grooming"]),
        .init(id: "education", name: "Learning", short: "Learning", hex: 0x3E8C86, direction: .moneyOut, nature: .need, symbol: "book.fill",
              words: ["school","fees","school fees","tuition","course","courses","book","books","udemy","coursera","class","exam","jamb","waec","training","bootcamp","certification","workshop fee","lesson","tutor","masterclass"]),
        .init(id: "giving", name: "Family & giving", short: "Giving", hex: 0xC99A3E, direction: .moneyOut, nature: .give, symbol: "gift.fill",
              words: ["gift","gifts","gave","mum","mom","mother","dad","father","family","sister","brother","sibling","church","tithe","offering","donation","donate","charity","mosque","zakat","friend","birthday gift","wedding gift","sent to","support","help","girlfriend","boyfriend","wife","husband","baby","kids","children","aunty","uncle","cousin","grandma","granny"]),
        .init(id: "savings", name: "Savings & investing", short: "Savings", hex: 0x2F6B4A, direction: .moneyOut, nature: .save, symbol: "leaf.fill",
              words: ["saved","save","savings","invest","invested","investment","stocks","stock","shares","crypto","bitcoin","btc","eth","usdt","piggyvest","cowrywise","risevest","bamboo","trove","emergency fund","fixed deposit","mutual fund","etf","index fund","robinhood","vanguard","pension","retirement","401k","isa","put aside","set aside","kolo","ajo","esusu","thrift"]),
        .init(id: "debt", name: "Debt repayment", short: "Debt", hex: 0x7C7468, direction: .moneyOut, nature: .need, symbol: "creditcard.fill",
              words: ["loan","repay","repayment","debt","credit card","owe","owed","paid back","installment","instalment","klarna","afterpay","carbon","fairmoney","palmcredit","borrowed"]),
        .init(id: "business", name: "Business costs", short: "Business", hex: 0xD7B98C, direction: .moneyOut, nature: .need, symbol: "shippingbox.fill",
              words: ["inventory","stock up","supplies","materials","ads","advertising","facebook ads","instagram ads","printing","packaging","logistics","delivery fee","dispatch","shipping","domain","hosting","server","contractor","staff","salary to","wages to","tools"]),
        .init(id: "other", name: "Everything else", short: "Other", hex: 0xDCD4C2, direction: .moneyOut, nature: .want, symbol: "star.fill", words: []),
        .init(id: "salary", name: "Salary", short: "Salary", hex: 0x2B3FA8, direction: .moneyIn, nature: .income, symbol: "briefcase.fill",
              words: ["salary","paycheck","pay check","wages","wage","payday","pay day","monthly pay","stipend","payroll"]),
        .init(id: "trade", name: "Sales", short: "Sales", hex: 0x3F8F64, direction: .moneyIn, nature: .income, symbol: "storefront.fill",
              words: ["sold","sale","sales","customer","customers","profit","revenue","order","orders","business","shop","store","market sales","pos","invoice paid"]),
        .init(id: "craft", name: "Freelance & creator", short: "Freelance", hex: 0xD9472B, direction: .moneyIn, nature: .income, symbol: "paintpalette.fill",
              words: ["freelance","gig","client","brand deal","sponsorship","sponsor","youtube","adsense","tiktok","creator fund","commission","contract","upwork","fiverr","design job","project payment","consulting","royalties","affiliate","ugc","logo","design","designs","website","photoshoot","shoot","editing","video edit","tutoring","lesson","lessons","side hustle","hustle","article","writing","job","jobs","session","sessions"]),
        .init(id: "blessing", name: "Gifts received", short: "Gifts", hex: 0xD98BA0, direction: .moneyIn, nature: .income, symbol: "heart.fill",
              words: ["gift","gave me","sent me","birthday money","allowance","pocket money","blessing","dash","spraying","sprayed","from mom","from dad","from mum"]),
        .init(id: "harvest", name: "Returns & interest", short: "Returns", hex: 0xB8B05A, direction: .moneyIn, nature: .income, symbol: "chart.line.uptrend.xyaxis",
              words: ["interest","dividend","dividends","returns","roi","yield","matured","staking","profit from investment"]),
        .init(id: "refund", name: "Refunds", short: "Refunds", hex: 0x98AADE, direction: .moneyIn, nature: .income, symbol: "arrow.uturn.left.circle.fill",
              words: ["refund","refunded","reversal","reversed","cashback","cash back","returned"]),
        .init(id: "windfall", name: "Other income", short: "Windfall", hex: 0xE9C75B, direction: .moneyIn, nature: .income, symbol: "sparkle",
              words: ["won","winnings","bonus","prize","found","jackpot","lottery win","payout","grant","scholarship","award"]),
    ]

    private static let byId: [String: MoneyCategory] = Dictionary(uniqueKeysWithValues: all.map { ($0.id, $0) })
    static func of(_ id: String) -> MoneyCategory { byId[id] ?? byId["other"]! }
    static func list(_ dir: Direction) -> [MoneyCategory] { all.filter { $0.direction == dir } }
}

extension Color {
    init(hex: UInt32, opacity: Double = 1) {
        self.init(.sRGB,
                  red: Double((hex >> 16) & 0xFF) / 255,
                  green: Double((hex >> 8) & 0xFF) / 255,
                  blue: Double(hex & 0xFF) / 255,
                  opacity: opacity)
    }
}
