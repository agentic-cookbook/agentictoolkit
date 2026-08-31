import AppKit
import AgenticToolkitCore
import AgenticToolkitCoreMacOS

/// The single mutable copy of the theme being edited, shared by every topic
/// panel in the theme editor.
///
/// The five topics are separate view controllers, each editing a slice of the
/// same value type. Handing each one its own `ColorTheme` would give five
/// panels five copies that drift the moment the first edit lands. So the theme
/// lives here, edits go through `update(_:)`, and the panels hold controls and
/// nothing else — one owner for the state (`dry`, `explicit-over-implicit`).
@MainActor
final class ThemeEditorContext {

    private(set) var theme: ColorTheme
    let store: ThemeStore

    /// Called with the updated theme after every accepted edit. The detail panel
    /// uses it to refresh the live preview and the sidebar swatch, and — once
    /// edits settle — to re-apply the theme app-wide.
    var onEdit: ((ColorTheme) -> Void)?

    /// Locked themes (built-in or imported) are shown but never changed. Every
    /// topic disables its controls, *and* `update(_:)` refuses outright, so one
    /// control that forgot to disable itself still can't write to one
    /// (`fail-fast` at the single place that matters).
    var isEditable: Bool { theme.isEditable }

    init(theme: ColorTheme, store: ThemeStore) {
        self.theme = theme
        self.store = store
    }

    func update(_ transform: (inout ColorTheme) -> Void) {
        guard theme.isEditable else { return }
        var updated = theme
        transform(&updated)
        theme = updated
        store.update(updated)
        onEdit?(updated)
    }
}
