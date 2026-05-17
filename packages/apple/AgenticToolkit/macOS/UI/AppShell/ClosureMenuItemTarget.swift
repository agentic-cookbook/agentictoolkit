import AppKit

/// Wraps a `() -> Void` closure as an `NSMenuItem` target/selector pair so
/// `MenuManager` can build menu items from `MenuContribution`s without any
/// per-feature `@objc` action plumbing. The host retains one of these per
/// menu item.
@MainActor
public final class ClosureMenuItemTarget: NSObject {

    private let action: () -> Void
    private let isEnabled: () -> Bool

    public init(action: @escaping () -> Void, isEnabled: @escaping () -> Bool = { true }) {
        self.action = action
        self.isEnabled = isEnabled
    }

    @objc(performMenuAction:) public func performMenuAction(_ sender: Any?) {
        action()
    }

    @objc public func validateMenuItem(_ item: NSMenuItem) -> Bool {
        isEnabled()
    }
}
