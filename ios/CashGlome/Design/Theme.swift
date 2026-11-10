import SwiftUI
import UIKit

/// Gallery at night: warm near-black walls, paper-white type, colour kept for the money and the paintings.
/// (In light mode: museum paper and ink.)
enum Theme {
    static let canvas = Color.dynamic(light: 0xF6F1E7, dark: 0x0E0C0A)
    static let surface = Color.dynamic(light: 0xFFFDF8, dark: 0x191612)
    static let raised = Color.dynamic(light: 0xEFE8DA, dark: 0x231F1A)
    static let hairline = Color.dynamic(light: 0x1E1B16, dark: 0xF4EDE1, opacity: 0.08)
    static let ink = Color.dynamic(light: 0x1E1B16, dark: 0xF4EDE1)
    static let ink2 = Color.dynamic(light: 0x5C554B, dark: 0xBDB3A3)
    static let ink3 = Color.dynamic(light: 0x8A8072, dark: 0x82796C)
    static let gold = Color(hex: 0xC99A3E)
    static let moneyIn = Color.dynamic(light: 0x2F7A4F, dark: 0x6CC08A)
    static let moneyOut = Color.dynamic(light: 0xB9452B, dark: 0xE77A5F)
    static let saved = Color.dynamic(light: 0x2F6B4A, dark: 0x8FCFA8)

    /// Display type: New York, Apple's serif, for headlines and big numbers.
    static func display(_ size: CGFloat, _ weight: Font.Weight = .regular) -> Font { .system(size: size, weight: weight, design: .serif) }
    static func number(_ size: CGFloat, _ weight: Font.Weight = .semibold) -> Font { .system(size: size, weight: weight, design: .rounded).monospacedDigit() }

    static let spring = Animation.spring(response: 0.32, dampingFraction: 0.86)
    static let snappy = Animation.snappy(duration: 0.22)
}

extension Color {
    static func dynamic(light: UInt32, dark: UInt32, opacity: Double = 1) -> Color {
        Color(UIColor { traits in
            let hex = traits.userInterfaceStyle == .dark ? dark : light
            return UIColor(red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255,
                           blue: CGFloat(hex & 0xFF) / 255, alpha: opacity)
        })
    }
}

// MARK: Surfaces

/// Content sits on solid cards; glass is kept for the controls that float above content (Apple's rule for Liquid Glass).
struct Card<Content: View>: View {
    var padding: CGFloat = 18
    @ViewBuilder var content: Content
    var body: some View {
        content
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.surface, in: RoundedRectangle(cornerRadius: 26, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 26, style: .continuous).strokeBorder(Theme.hairline))
    }
}

extension View {
    /// Liquid Glass on iOS 26, a frosted material before that. Capsule-shaped.
    func glass(interactive: Bool = false, tint: Color? = nil) -> some View {
        glass(in: Capsule(), interactive: interactive, tint: tint)
    }

    /// Liquid Glass on iOS 26, a frosted material before that.
    @ViewBuilder
    func glass<S: Shape>(in shape: S, interactive: Bool = false, tint: Color? = nil) -> some View {
        if #available(iOS 26.0, *) {
            self.glassEffect(makeGlass(interactive: interactive, tint: tint), in: shape)
        } else {
            self.background(.ultraThinMaterial, in: shape)
                .overlay(shape.stroke(Color.white.opacity(0.12), lineWidth: 0.5))
                .shadow(color: .black.opacity(0.18), radius: 16, y: 6)
        }
    }

    /// A small uppercase label above a section.
    func eyebrow() -> some View {
        self.font(.system(size: 12, weight: .semibold)).textCase(.uppercase).tracking(0.8).foregroundStyle(Theme.ink3)
    }
}

@available(iOS 26.0, *)
private func makeGlass(interactive: Bool, tint: Color?) -> Glass {
    var g = Glass.regular
    if let tint { g = g.tint(tint) }
    if interactive { g = g.interactive() }
    return g
}

/// The main call to action: a gold capsule.
struct PrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 17, weight: .semibold))
            .foregroundStyle(Color(hex: 0x1E1B16))
            .padding(.vertical, 15).frame(maxWidth: .infinity)
            .background(Theme.gold, in: Capsule())
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .opacity(configuration.isPressed ? 0.9 : 1)
            .animation(Theme.snappy, value: configuration.isPressed)
    }
}

/// Every tappable card shrinks a touch under the finger, like system controls.
struct PressableStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.975 : 1)
            .animation(Theme.snappy, value: configuration.isPressed)
    }
}

enum Haptics {
    static func tap() { if AppSettings.shared.haptics { UIImpactFeedbackGenerator(style: .light).impactOccurred() } }
    static func success() { if AppSettings.shared.haptics { UINotificationFeedbackGenerator().notificationOccurred(.success) } }
    static func warning() { if AppSettings.shared.haptics { UINotificationFeedbackGenerator().notificationOccurred(.warning) } }
    static func select() { if AppSettings.shared.haptics { UISelectionFeedbackGenerator().selectionChanged() } }
}

/// A category's colour chip with its symbol.
struct CategoryBadge: View {
    let cat: MoneyCategory
    var size: CGFloat = 36
    var body: some View {
        Image(systemName: cat.symbol)
            .font(.system(size: size * 0.42, weight: .semibold))
            .foregroundStyle(.white)
            .frame(width: size, height: size)
            .background(cat.color.gradient, in: RoundedRectangle(cornerRadius: size * 0.32, style: .continuous))
    }
}
