import Foundation

/// Platform-neutral RGBA color value with normalized [0, 1] components.
/// Encodes as `"#RRGGBBAA"` so settings round-trip cleanly through
/// `UserDefaults`. UI layers add a platform-color (NSColor/UIColor) bridge.
public struct RGBAColor: Codable, Sendable, Equatable {
    public let red: Double
    public let green: Double
    public let blue: Double
    public let alpha: Double

    /// Components are clamped to `[0, 1]` so a malformed source (an imported
    /// `.itermcolors` with an out-of-gamut/rounding-artifact value, or a NaN
    /// from color math) can never store an out-of-range or non-finite channel
    /// that would later corrupt rendering or trap on conversion.
    public init(red: Double, green: Double, blue: Double, alpha: Double) {
        self.red = red.clamped()
        self.green = green.clamped()
        self.blue = blue.clamped()
        self.alpha = alpha.clamped()
    }

    /// Parses `"#RRGGBBAA"` (the leading `#` is optional, case-insensitive).
    /// Returns nil on any parse failure.
    public init?(hexString: String) {
        var hex = hexString
        if hex.hasPrefix("#") { hex.removeFirst() }
        guard hex.count == 8, let value = UInt32(hex, radix: 16) else { return nil }
        self.red   = Double((value >> 24) & 0xFF) / 255
        self.green = Double((value >> 16) & 0xFF) / 255
        self.blue  = Double((value >> 8)  & 0xFF) / 255
        self.alpha = Double( value        & 0xFF) / 255
    }

    /// Serializes to `"#RRGGBBAA"` (uppercase, always 9 characters).
    public var hexString: String {
        let redByte = Int((red.clamped() * 255).rounded())
        let greenByte = Int((green.clamped() * 255).rounded())
        let blueByte = Int((blue.clamped() * 255).rounded())
        let alphaByte = Int((alpha.clamped() * 255).rounded())
        return String(format: "#%02X%02X%02X%02X", redByte, greenByte, blueByte, alphaByte)
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let hex = try container.decode(String.self)
        guard let parsed = RGBAColor(hexString: hex) else {
            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "Expected #RRGGBBAA hex color string."
            )
        }
        self = parsed
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(self.hexString)
    }
}

extension RGBAColor {
    public static let black = RGBAColor(red: 0, green: 0, blue: 0, alpha: 1)
    public static let white = RGBAColor(red: 1, green: 1, blue: 1, alpha: 1)
    public static let clear = RGBAColor(red: 0, green: 0, blue: 0, alpha: 0)
}

/// A `UserSetting` storing an RGBA color (encoded as `"#RRGGBBAA"`).
public typealias ColorSetting = UserSetting<RGBAColor>

private extension Double {
    func clamped() -> Double { Swift.min(1, Swift.max(0, self)) }
}
