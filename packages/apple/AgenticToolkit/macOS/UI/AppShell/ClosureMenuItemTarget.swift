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

/// Applies `MenuContribution.isHidden` to the items of one menu.
///
/// Visibility deliberately does *not* ride along on `validateMenuItem(_:)`:
/// AppKit's automatic validation is about enabling, and an item that has
/// already hidden itself is not reliably asked again — which would make
/// hiding a one-way trip. `menuNeedsUpdate(_:)` runs for the whole menu every
/// time it opens, hidden items included.
@MainActor
public final class MenuVisibilityDelegate: NSObject, NSMenuDelegate {

    private var rules: [(item: NSMenuItem, isHidden: () -> Bool)] = []

    public func add(_ item: NSMenuItem, isHidden: @escaping () -> Bool) {
        rules.append((item, isHidden))
    }

    public var isEmpty: Bool { rules.isEmpty }

    public func menuNeedsUpdate(_ menu: NSMenu) {
        for rule in rules {
            rule.item.isHidden = rule.isHidden()
        }
    }
}
