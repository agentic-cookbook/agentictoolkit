import AppKit
import SwiftUI

extension Color {

    /// Creates a Color from a hex string (e.g., "#FF5733" or "FF5733").
    ///
    /// Returns nil if the string is not a valid 6-digit hex color.
    public init?(hex: String) {
        var hexSanitized = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        if hexSanitized.hasPrefix("#") {
            hexSanitized.removeFirst()
        }

        guard hexSanitized.count == 6 else { return nil }

        var rgbValue: UInt64 = 0
        guard Scanner(string: hexSanitized).scanHexInt64(&rgbValue) else { return nil }

        let red = Double((rgbValue & 0xFF0000) >> 16) / 255.0
        let green = Double((rgbValue & 0x00FF00) >> 8) / 255.0
        let blue = Double(rgbValue & 0x0000FF) / 255.0

        self.init(red: red, green: green, blue: blue)
    }

    /// Converts a SwiftUI Color to a hex string (e.g., "#FF5733").
    ///
    /// Falls back to "#007AFF" (system blue) if the conversion fails.
    public func toHexString() -> String {
        guard let nsColor = NSColor(self).usingColorSpace(.sRGB) else {
            return "#007AFF"
        }

        let red = Int(round(nsColor.redComponent * 255))
        let green = Int(round(nsColor.greenComponent * 255))
        let blue = Int(round(nsColor.blueComponent * 255))

        return String(format: "#%02X%02X%02X", red, green, blue)
    }
}
