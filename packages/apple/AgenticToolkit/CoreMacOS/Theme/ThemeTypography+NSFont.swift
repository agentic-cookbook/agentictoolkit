import AppKit
import AgenticToolkitCore

/// AppKit bridge for the Foundation-only typography model. Lives in CoreMacOS so
/// `AgenticToolkitCore` stays AppKit-free.
extension FontWeight {
    /// The matching `NSFont.Weight`.
    public var nsWeight: NSFont.Weight {
        switch self {
        case .ultraLight: return .ultraLight
        case .thin:       return .thin
        case .light:      return .light
        case .regular:    return .regular
        case .medium:     return .medium
        case .semibold:   return .semibold
        case .bold:       return .bold
        case .heavy:      return .heavy
        case .black:      return .black
        }
    }
}

extension FontStyle {
    /// Resolve to an `NSFont` at `scaledSize` (the size *after* the theme's global
    /// scale has been applied). A custom `family` is used when installed (falling
    /// back to the system font otherwise), monospaced roles use the system
    /// monospaced face, and everything else uses the system face at `weight`.
    public func nsFont(scaledSize: CGFloat) -> NSFont {
        if let family, let base = NSFont(name: family, size: scaledSize) {
            // Best-effort weight for arbitrary families: apply a bold trait for
            // semibold-and-heavier (AppKit can't dial arbitrary weights on a
            // named family the way it can for the system font).
            if weight.nsWeight.rawValue >= NSFont.Weight.semibold.rawValue {
                return NSFontManager.shared.convert(base, toHaveTrait: .boldFontMask)
            }
            return base
        }
        if monospaced {
            return NSFont.monospacedSystemFont(ofSize: scaledSize, weight: weight.nsWeight)
        }
        return NSFont.systemFont(ofSize: scaledSize, weight: weight.nsWeight)
    }
}

extension SemanticPalette {
    /// The resolved `NSFont` for a `TextRole` (family / size×scale / weight /
    /// monospaced), per the theme's typography.
    public func font(_ role: TextRole) -> NSFont {
        theme.typography.style(role).nsFont(scaledSize: CGFloat(theme.typography.size(role)))
    }
}
