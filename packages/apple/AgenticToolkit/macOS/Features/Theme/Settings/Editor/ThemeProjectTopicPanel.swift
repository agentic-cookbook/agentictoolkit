import AppKit
import AgenticToolkitCore
import AgenticToolkitCoreMacOS

/// "Project" topic: this theme's optional overrides of the Projects settings
/// panel — the theme-side counterpart of that panel, exactly as the Terminal
/// topic is of the Terminal panel.
///
/// Same contract as the Terminal topic: every override is `Optional` and starts
/// `nil`, the controls show the **resolved** value, and touching one is what
/// records the override.
@MainActor
final class ThemeProjectTopicPanel: ThemeTopicPanel {

    private let outlineCheckbox = NSButton(
        checkboxWithTitle: "Outline the active pane", target: nil, action: nil)
    private let clearButton = NSButton(title: "Use Projects Settings", target: nil, action: nil)

    init(context: ThemeEditorContext) {
        super.init(context: context, title: "Project", symbol: "square.split.2x2")
    }

    override var helpContent: ComposableSettings.PanelHelp? {
        ComposableSettings.PanelHelp(topics: [
            .init(
                title: "Theme Options Override the Defaults",
                body: "These override the matching options on the Projects settings panel "
                    + "whenever this theme is active. A theme starts with none of them set, "
                    + "so until you change something the Projects panel is what decides — "
                    + "which is why the controls open showing its values."
            ),
            .init(
                title: "The Active Pane",
                body: "A project window splits into panes, and one of them has the keyboard. "
                    + "The outline is how you can tell which. A theme sets its own outline "
                    + "color because the color that reads clearly against a dark theme "
                    + "disappears against a light one — which is the whole reason this is a "
                    + "theme option and not only an app-wide one."
            ),
            .init(
                title: "Going Back to the Defaults",
                body: "\"Use Projects Settings\" drops every project override this theme has "
                    + "and the controls fall back to showing the Projects panel's values. "
                    + "With no outline color of its own, a theme outlines the active pane in "
                    + "its raised-surface tone."
            )
        ])
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        addGroup(makeActivePaneGroup())
        addGroup(makeDefaultsGroup())
    }

    private func makeActivePaneGroup() -> ComposableSettings.GroupView {
        let group = ComposableSettings.GroupView(withTitle: "Active Pane")
        let overrides = context.theme.project

        outlineCheckbox.state = (overrides?.highlightActivePane ?? UserSettings.highlightActivePane.value)
            ? .on : .off
        outlineCheckbox.target = self
        outlineCheckbox.action = #selector(highlightChanged(_:))
        outlineCheckbox.isEnabled = context.isEditable
        group.addSettingSubview(outlineCheckbox)

        // No override means "the theme's raised-surface tone", so that is what
        // the well opens showing — a color the user can then commit to by
        // changing it (`principle-of-least-astonishment`).
        let palette = SemanticPalette(theme: context.theme)
        let outline = overrides?.paneOutline ?? palette.color(.elevatedSurface)
        group.addSettingSubview(wellColumn("Outline", .paneOutline, outline))

        return group
    }

    private func makeDefaultsGroup() -> ComposableSettings.GroupView {
        let group = ComposableSettings.GroupView(withTitle: "Defaults")
        clearButton.bezelStyle = .rounded
        clearButton.target = self
        clearButton.action = #selector(clearOverrides(_:))
        group.addSettingSubview(clearButton)
        refreshClearButton()
        return group
    }

    /// The outline well writes through the base class, so this is where a color
    /// edit gets to re-enable "back to the defaults".
    override func didApplyColor(to slot: Slot) {
        refreshClearButton()
    }

    // MARK: - Edits

    @objc private func highlightChanged(_ sender: NSButton) {
        context.update { theme in
            theme.project = (theme.project ?? ThemeProjectOptions()).with {
                $0.highlightActivePane = sender.state == .on
            }
        }
        refreshClearButton()
    }

    @objc private func clearOverrides(_ sender: NSButton) {
        context.update { $0.project = nil }
        outlineCheckbox.state = UserSettings.highlightActivePane.value ? .on : .off
        refreshClearButton()
    }

    private func refreshClearButton() {
        clearButton.isEnabled = context.isEditable && !(context.theme.project?.isEmpty ?? true)
    }
}
