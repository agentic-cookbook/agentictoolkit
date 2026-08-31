import AppKit
import AgenticToolkitCore
import AgenticToolkitCoreMacOS

/// "Colors" topic: the theme's semantic roles — the colors the *app* is drawn
/// with, as opposed to the terminal palette, which has its own topic.
@MainActor
final class ThemeColorsTopicPanel: ThemeTopicPanel {

    private static let colorGroups: [(title: String, items: [(ThemeRole, String)])] = [
        ("Backgrounds", [(.windowBackground, "Window"), (.surface, "Panel"),
                         (.elevatedSurface, "Raised"), (.controlBackground, "Field")]),
        ("Text", [(.primaryText, "Primary"), (.secondaryText, "Secondary"),
                  (.tertiaryText, "Tertiary"), (.placeholderText, "Placeholder"),
                  (.onAccentText, "On accent")]),
        ("Accent & status", [(.accent, "Accent"), (.success, "Success"),
                             (.warning, "Warning"), (.danger, "Error"), (.info, "Info")]),
        ("Lines & selection", [(.border, "Border"), (.outline, "Outline"),
                               (.divider, "Divider"), (.selection, "Selection")])
    ]

    init(context: ThemeEditorContext) {
        super.init(context: context, title: "Colors", symbol: "paintpalette")
    }

    override var helpContent: ComposableSettings.PanelHelp? {
        ComposableSettings.PanelHelp(topics: [
            .init(
                title: "Roles, Not Places",
                body: "Each well is a *role* — \"panel background\", \"secondary text\", "
                    + "\"accent\" — not one particular control. Everything in the app that "
                    + "plays that role uses the color, so setting Accent once re-tints every "
                    + "button, highlight and focus ring at the same time."
            ),
            .init(
                title: "What Each Group Is",
                body: "Backgrounds go from furthest back to nearest: window, panel, raised "
                    + "panel, then the inside of a text field. Text runs from primary down "
                    + "to placeholder, with \"on accent\" being text drawn *on* an accent "
                    + "fill. Lines & selection are the hairlines and the highlight."
            ),
            .init(
                title: "Seeing It",
                body: "The Preview tab shows these colors on real chrome as you change them, "
                    + "and the app itself re-themes a moment after you stop — the theme you "
                    + "are editing is made active while its panel is open, so the settings "
                    + "window around you is the truest preview there is."
            )
        ])
    }

    override func viewDidLoad() {
        super.viewDidLoad()

        let palette = SemanticPalette(theme: context.theme)
        for group in Self.colorGroups {
            let settingsGroup = ComposableSettings.GroupView(withTitle: group.title)
            let grid = column([], spacing: 8)
            for chunk in stride(from: 0, to: group.items.count, by: 5) {
                let rowItems = group.items[chunk..<min(chunk + 5, group.items.count)]
                let wells = rowItems.map { wellColumn($0.1, .role($0.0), palette.color($0.0)) }
                grid.addArrangedSubview(row(wells))
            }
            settingsGroup.addSettingSubview(grid)
            addGroup(settingsGroup)
        }
    }
}
