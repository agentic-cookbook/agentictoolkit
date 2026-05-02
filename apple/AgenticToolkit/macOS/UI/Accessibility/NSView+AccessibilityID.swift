import AppKit

extension NSView {
    @discardableResult
    public func accessibilityID(_ identifier: String) -> Self {
        setAccessibilityIdentifier(identifier)
        return self
    }
}

extension NSMenuItem {
    @discardableResult
    public func accessibilityID(_ identifier: String) -> Self {
        setAccessibilityIdentifier(identifier)
        return self
    }
}

extension NSWindow {
    @discardableResult
    public func accessibilityID(_ identifier: String) -> Self {
        setAccessibilityIdentifier(identifier)
        return self
    }
}

public enum AccessibilityID {
    public static func slug(_ title: String) -> String {
        title.lowercased()
            .components(separatedBy: CharacterSet.alphanumerics.inverted)
            .filter { !$0.isEmpty }
            .joined(separator: "-")
    }
}
