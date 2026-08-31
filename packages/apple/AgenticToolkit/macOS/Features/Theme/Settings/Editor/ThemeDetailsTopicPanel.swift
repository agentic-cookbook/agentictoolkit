import AppKit
import AgenticToolkitCore
import AgenticToolkitCoreMacOS

/// "Details" topic: what the theme is called, whether it is a light or a dark
/// theme, and who made it. Editable for a custom theme; for a locked one the
/// fields are read-only and a lock note leads.
@MainActor
final class ThemeDetailsTopicPanel: ThemeTopicPanel {

    /// Called after a rename so the sidebar row and the panel title re-read it.
    private let onRenamed: (String) -> Void

    init(context: ThemeEditorContext, onRenamed: @escaping (String) -> Void) {
        self.onRenamed = onRenamed
        super.init(context: context, title: "Details", symbol: "info.circle")
    }

    override var helpContent: ComposableSettings.PanelHelp? {
        ComposableSettings.PanelHelp(topics: [
            .init(
                title: "Name",
                body: "What the theme is called in the list on the left and anywhere else "
                    + "the app offers a theme. It has to be something — an empty name would "
                    + "leave a blank row you could not tell from any other, so a blank entry "
                    + "snaps back to the previous name."
            ),
            .init(
                title: "Style",
                body: "Whether this is a light or a dark theme. It does not change any of "
                    + "the colors; it tells the app which system appearance the theme is "
                    + "meant to sit in, so standard controls and menus are drawn to match."
            ),
            .init(
                title: "Locked Themes",
                body: "Built-in and imported themes cannot be edited — an update or a "
                    + "re-import would overwrite your changes without warning. Duplicate one "
                    + "from the footer under the theme list and edit the copy, which is "
                    + "yours and is never overwritten."
            )
        ])
    }

    override func viewDidLoad() {
        super.viewDidLoad()

        let group = ComposableSettings.GroupView(withTitle: "Details")
        if !context.isEditable {
            group.addSettingSubview(makeLockRow())
        }
        group.addSettingSubview(makeFieldsGrid())
        addGroup(group)
    }

    private func makeFieldsGrid() -> NSView {
        let editable = context.isEditable
        let theme = context.theme

        let nameField = NSTextField(string: theme.name)
        nameField.target = self
        nameField.action = #selector(nameChanged(_:))
        nameField.isEditable = editable
        nameField.translatesAutoresizingMaskIntoConstraints = false
        nameField.widthAnchor.constraint(greaterThanOrEqualToConstant: 240).isActive = true

        let appearancePopUp = NSPopUpButton()
        for appearance in ThemeAppearance.allCases {
            appearancePopUp.addItem(withTitle: appearance.rawValue.capitalized)
            appearancePopUp.lastItem?.representedObject = appearance
        }
        appearancePopUp.target = self
        appearancePopUp.action = #selector(appearanceChanged(_:))
        appearancePopUp.isEnabled = editable
        for (index, item) in appearancePopUp.itemArray.enumerated()
        where item.representedObject as? ThemeAppearance == theme.appearance {
            appearancePopUp.selectItem(at: index)
        }

        let attributionField = NSTextField(string: theme.attribution ?? "")
        attributionField.placeholderString = "Author or source"
        attributionField.target = self
        attributionField.action = #selector(attributionChanged(_:))
        attributionField.isEditable = editable
        attributionField.translatesAutoresizingMaskIntoConstraints = false
        attributionField.widthAnchor.constraint(greaterThanOrEqualToConstant: 240).isActive = true

        let grid = NSGridView(views: [
            [rightLabel("Name"), nameField],
            [rightLabel("Style"), appearancePopUp],
            [rightLabel("Attribution"), attributionField]
        ])
        grid.rowSpacing = 8
        grid.columnSpacing = 8
        grid.column(at: 0).xPlacement = .leading
        grid.translatesAutoresizingMaskIntoConstraints = false
        return grid
    }

    /// A lock glyph + guidance shown at the top of a locked theme's Details.
    private func makeLockRow() -> NSView {
        let icon = NSImageView()
        icon.image = NSImage(systemSymbolName: "lock.fill", accessibilityDescription: "Locked")
        icon.contentTintColor = ThemePaletteObserver.currentPalette.secondaryTextColor
        icon.setContentHuggingPriority(.required, for: .horizontal)

        let label = NSTextField(wrappingLabelWithString: context.theme.isBuiltIn
            ? "Built-in theme — duplicate it to customize its colors and fonts."
            : "Imported theme — duplicate it to customize its colors and fonts.")
        label.textColor = ThemePaletteObserver.currentPalette.secondaryTextColor
        label.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)

        let stack = row([icon, label], spacing: 6)
        stack.alignment = .centerY
        return stack
    }

    // MARK: - Edits

    @objc private func nameChanged(_ sender: NSTextField) {
        guard context.isEditable else { return }
        let trimmed = sender.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
        // Reject an empty/whitespace name: it would leave a blank sidebar row and
        // a blank panel title that's impossible to tell apart or re-select. Snap
        // the field back to the current name.
        guard !trimmed.isEmpty else {
            sender.stringValue = context.theme.name
            return
        }
        context.update { $0.name = trimmed }
        onRenamed(trimmed)
    }

    @objc private func appearanceChanged(_ sender: NSPopUpButton) {
        guard let appearance = sender.selectedItem?.representedObject as? ThemeAppearance else { return }
        context.update { $0.appearance = appearance }
    }

    @objc private func attributionChanged(_ sender: NSTextField) {
        let trimmed = sender.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
        context.update { $0.attribution = trimmed.isEmpty ? nil : trimmed }
    }
}
