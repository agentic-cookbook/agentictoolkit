import AppKit

/// One menu item a feature wants the host's `MenuManager` to install.
/// Coordinators return `[MenuContribution]` from `menuContributions()`;
/// `MenuManager` collects them, sorts by slot+order, and builds the
/// AppKit `NSMenuItem` hierarchy with closure-based actions (no
/// per-item `target`/`#selector` boilerplate on the part of the
/// contributor).
public struct MenuContribution {

    /// Where in the menu hierarchy the item belongs.
    public enum Slot: Hashable, Sendable {
        /// App menu (Whippet menu) — typically About / Settings… / Quit.
        case app
        /// File menu — typically New / Open / Close / Save.
        case file
        /// View menu — typically Toggle Sidebar / Enter Full Screen.
        case view
        /// Window menu — typically Minimize / Zoom / Bring All to Front +
        /// app-specific window pickers.
        case window
        /// Status-item dropdown. The `section` integer groups items between
        /// separators (lower = higher in the menu).
        case statusItem(section: Int)
    }

    public let slot: Slot
    public let title: String
    /// Sort key within the slot (and within the section for `.statusItem`).
    /// Lower comes first.
    public let order: Int
    /// Key equivalent (e.g. `"t"`) or empty string for none.
    public let key: String
    /// Modifier mask. Default `.command`.
    public let modifiers: NSEvent.ModifierFlags
    /// Optional dynamic enable check. Default always-enabled.
    public let isEnabled: () -> Bool
    /// What to do when the user activates the item.
    public let action: () -> Void

    public init(
        slot: Slot,
        title: String,
        order: Int = 0,
        key: String = "",
        modifiers: NSEvent.ModifierFlags = .command,
        isEnabled: @escaping () -> Bool = { true },
        action: @escaping () -> Void
    ) {
        self.slot = slot
        self.title = title
        self.order = order
        self.key = key
        self.modifiers = modifiers
        self.isEnabled = isEnabled
        self.action = action
    }
}
