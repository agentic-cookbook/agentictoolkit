import AppKit
import AgenticToolkitCore

/// A pull-down button that filters on any combination of a short, fixed list of
/// choices — the "Good for: Coding, Writing" control above a picker's table.
///
/// Choices are identified by opaque string ids so one control serves any caller's
/// enum without this file knowing about it; callers map ids back to their own type.
///
/// A menu closes when an item is picked, so several boxes take several trips. That
/// is the stock behaviour of a checkable menu, and the alternative — items hosting
/// their own checkbox views to keep the menu open — trades a familiar control for a
/// hand-built one. The summary title says what is on without opening it, and "Any"
/// clears the whole set in one click.
@MainActor
public final class MultiChoiceFilterButton: NSPopUpButton {

    public struct Choice: Sendable, Equatable {
        public let id: String
        public let title: String
        /// Tooltip — what the choice covers, for the ones a label can't carry.
        public let detail: String

        public init(id: String, title: String, detail: String = "") {
            self.id = id
            self.title = title
            self.detail = detail
        }
    }

    /// Fired whenever the selection changes, never on a no-op re-pick.
    public var onChange: ((Set<String>) -> Void)?

    public private(set) var selection: Set<String> = [] {
        didSet {
            guard selection != oldValue else { return }
            refreshTitle()
            onChange?(selection)
        }
    }

    private let label: String
    private let choices: [Choice]
    private var themeObserver: ThemePaletteObserver?

    /// `label` names the axis ("Good for") and prefixes the summary title.
    public init(label: String, choices: [Choice]) {
        self.label = label
        self.choices = choices
        super.init(frame: .zero, pullsDown: true)
        translatesAutoresizingMaskIntoConstraints = false
        buildMenu()
        refreshTitle()
        themeObserver = ThemePaletteObserver(host: self) { [weak self] palette in self?.applyTheme(palette) }
    }

    @available(*, unavailable)
    public required init?(coder: NSCoder) { fatalError() }

    /// Set the selection programmatically (restoring a remembered filter, say).
    public func setSelection(_ ids: Set<String>) {
        selection = ids.intersection(choices.map(\.id))
        syncStates()
    }

    // MARK: - Menu

    private func buildMenu() {
        let menu = NSMenu()
        // Item 0 of a pull-down is the button's own title; it is never chosen.
        menu.addItem(NSMenuItem(title: label, action: nil, keyEquivalent: ""))
        let any = NSMenuItem(title: "Any", action: #selector(clearSelection), keyEquivalent: "")
        any.target = self
        menu.addItem(any)
        menu.addItem(.separator())
        for choice in choices {
            let item = NSMenuItem(title: choice.title, action: #selector(toggleChoice(_:)), keyEquivalent: "")
            item.target = self
            item.representedObject = choice.id
            if !choice.detail.isEmpty { item.toolTip = choice.detail }
            menu.addItem(item)
        }
        self.menu = menu
    }

    @objc private func toggleChoice(_ sender: NSMenuItem) {
        guard let id = sender.representedObject as? String else { return }
        if selection.contains(id) { selection.remove(id) } else { selection.insert(id) }
        syncStates()
    }

    @objc private func clearSelection() {
        selection = []
        syncStates()
    }

    private func syncStates() {
        for item in menu?.items ?? [] {
            guard let id = item.representedObject as? String else { continue }
            item.state = selection.contains(id) ? .on : .off
        }
    }

    /// "Good for: Any" / "Good for: Coding" / "Good for: Coding, Writing" /
    /// "Good for: 4 selected" — the whole selection when it still fits in a
    /// glance, a count when it doesn't.
    private func refreshTitle() {
        let chosen = choices.filter { selection.contains($0.id) }.map(\.title)
        let summary: String
        switch chosen.count {
        case 0: summary = "Any"
        case 1, 2: summary = chosen.joined(separator: ", ")
        default: summary = "\(chosen.count) selected"
        }
        menu?.items.first?.title = "\(label): \(summary)"
        // A pull-down redraws its title from item 0 only when the menu is reset.
        synchronizeTitleAndSelectedItem()
        // The title just changed length, and the button's intrinsic width is measured
        // from it — without this, a longer summary lays out inside the old width and
        // gets truncated ("Good for: Cod…").
        invalidateIntrinsicContentSize()
    }

    private func applyTheme(_ palette: SemanticPalette) {
        contentTintColor = palette.primaryTextColor
        font = palette.font(.body)
    }
}
