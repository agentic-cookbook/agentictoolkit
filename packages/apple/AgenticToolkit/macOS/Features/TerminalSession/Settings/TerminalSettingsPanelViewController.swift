import AppKit

import AgenticToolkitCore

/// Settings panel for the terminal's layout, font and caret.
///
/// There is deliberately no color section: terminal colors are the app theme's,
/// edited in Theme settings, so there is one palette rather than two that drift
/// (`dry`).
@MainActor
public final class TerminalSettingsPanelViewController: ComposableSettings.SettingsPanelViewController {

    /// Width of the padding column's labels, so "Top" and "Bottom" end at the
    /// same place and the four fields line up under each other.
    private static let paddingLabelWidth: CGFloat = 60

    public init() {
        super.init(with: ComposableSettings.SettingsPanelDescriptor(
            title: "Terminal",
            icon: NSImage(systemSymbolName: "terminal", accessibilityDescription: nil)
        ))
    }

    public required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    public override var helpContent: ComposableSettings.PanelHelp? {
        ComposableSettings.PanelHelp(topics: [
            .init(
                title: "Padding",
                body: "Space between the terminal text and the edge of its pane, in points, "
                    + "set per side. A terminal sitting under a tab bar usually wants more "
                    + "room at the top than at the bottom, which is why there are four "
                    + "numbers and not one. Changes apply to every open terminal as you "
                    + "type them."
            ),
            .init(
                title: "Font",
                body: "The terminal's own font, independent of the theme's code font — a "
                    + "terminal is usually read at a different size from a code editor. "
                    + "Pick a monospaced face: a proportional one renders, but columns "
                    + "will not line up."
            ),
            .init(
                title: "Cursor",
                body: "Block, hollow block, underline or bar, blinking or steady. The caret "
                    + "keeps its shape whether or not the terminal has focus — the active "
                    + "pane is shown by the pane outline instead."
            ),
            .init(
                title: "Themes Override These",
                body: "A theme can carry its own terminal padding, font and cursor, and when "
                    + "it does they win over the values here. Those live in Theme settings, "
                    + "under the theme's Terminal topic. A theme has no terminal options "
                    + "until you set them, so by default this panel is what decides."
            ),
            .init(
                title: "Colors",
                body: "Terminal colors — foreground, background, cursor, selection and the 16 "
                    + "ANSI colors — are the active theme's, edited in Theme settings. One "
                    + "palette, not two that drift apart."
            )
        ])
    }

    public override func viewDidLoad() {
        super.viewDidLoad()
        self.settingsView.addGroup(createLayoutGroup())
        self.settingsView.addGroup(createFontGroup())
        self.settingsView.addGroup(createCursorGroup())
    }

    private func createLayoutGroup() -> ComposableSettings.GroupView {
        let group = ComposableSettings.GroupView(withTitle: "Padding")

        let sides: [(String, UserSetting<Int>)] = [
            ("Top", UserSettings.terminalPaddingTop),
            ("Left", UserSettings.terminalPaddingLeading),
            ("Bottom", UserSettings.terminalPaddingBottom),
            ("Right", UserSettings.terminalPaddingTrailing)
        ]

        // A column, not a row: the four numbers are the four sides of one box,
        // and stacked with right-aligned labels they read as the box.
        let column = ComposableSettings.VerticalStackView()
        for (title, setting) in sides {
            let viewModel = ComposableSettings.RangeViewModel<Int>(
                title: title,
                setting: setting,
                minValue: 0,
                maxValue: 80
            )
            column.addArrangedSubview(ComposableSettings.IntegerFieldView(
                viewModel: viewModel,
                labelWidth: Self.paddingLabelWidth))
        }
        group.addSettingSubview(column)

        return group
    }

    private func createFontGroup() -> ComposableSettings.GroupView {
        let group = ComposableSettings.GroupView(withTitle: "Font")

        let fontViewModel = ComposableSettings.FontViewModel(
            title: "Terminal font",
            nameSetting: UserSettings.terminalFontName,
            sizeSetting: UserSettings.terminalFontSize
        )
        group.addSettingSubview(ComposableSettings.FontPickerView(viewModel: fontViewModel))

        return group
    }

    private func createCursorGroup() -> ComposableSettings.GroupView {
        let group = ComposableSettings.GroupView(withTitle: "Cursor")

        let shape = ComposableSettings.ChoiceViewModel<TerminalCursorShape>(
            title: "Shape",
            setting: UserSettings.terminalCursorShape,
            choices: TerminalCursorShape.allCases.map { .init(label: $0.label, value: $0) }
        )
        group.addSettingSubview(ComposableSettings.PopupMenuChoiceView(viewModel: shape))

        let blinks = ComposableSettings.ViewModel<Bool>(
            title: "Blink",
            setting: UserSettings.terminalCursorBlinks
        )
        group.addSettingSubview(ComposableSettings.CheckboxView(with: blinks))

        return group
    }
}
