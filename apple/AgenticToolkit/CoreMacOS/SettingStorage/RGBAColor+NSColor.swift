import AppKit
import AgenticToolkitCore

public extension NSColor {

    /// Builds an `NSColor` in the sRGB color space from the given components.
    convenience init(_ rgba: RGBAColor) {
        self.init(srgbRed: rgba.red, green: rgba.green, blue: rgba.blue, alpha: rgba.alpha)
    }
}

extension RGBAColor {

    public init(_ color: NSColor) {
        self.init(
            red: Double(color.redComponent),
            green: Double(color.greenComponent),
            blue: Double(color.blueComponent),
            alpha: Double(color.alphaComponent)
        )
    }
}
