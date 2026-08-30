import AppKit

import AgenticToolkitCore

/// Settings panel for the terminal's layout, font and caret.
///
/// There is deliberately no color section: terminal colors are the app theme's,
/// edited in Theme settings, so there is one palette rather than two that drift
/// (`dry`).
@MainActor
public final class TerminalSettingsPanelViewController: ComposableSettings.SettingsPanelViewController {

    public init() {
        super.init(with: ComposableSettings.SettingsPanelDescriptor(
            title: "Terminal",
            icon: NSImage(systemSymbolName: "terminal", accessibilityDescription: nil)
        ))
    }

    public required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    public override func viewDidLoad() {
        super.viewDidLoad()
        self.settingsView.addGroup(createLayoutGroup())
        self.settingsView.addGroup(createFontGroup())
        self.settingsView.addGroup(createCursorGroup())
    }

    private func createLayoutGroup() -> ComposableSettings.GroupView {
        let group = ComposableSettings.GroupView(withTitle: "Layout")

        let padding = ComposableSettings.RangeViewModel<Double>(
            title: "Padding",
            setting: UserSettings.terminalPadding,
            minValue: 0,
            maxValue: 40,
            explanation: "Space between the terminal text and the edge of its pane."
        )
        group.addSettingSubview(
            ComposableSettings.CaptionedSliderView(viewModel: padding) { "\(Int($0.rounded())) pt" }
        )

        return group
    }

    private func createFontGroup() -> ComposableSettings.GroupView {
        let group = ComposableSettings.GroupView(withTitle: "Font")

        let usesTheme = ComposableSettings.ViewModel<Bool>(
            title: "Use the theme's code font",
            setting: UserSettings.terminalUsesThemeFont,
            explanation: "Turn this off to pick a font just for the terminal."
        )
        group.addSettingSubview(ComposableSettings.CheckboxView(with: usesTheme))

        // Only fixed-pitch families are offered — a proportional font in a
        // terminal is a broken grid, not a preference. The stored family may
        // not be installed on this machine, so it is added rather than
        // silently reset to something the user did not choose.
        var families = TerminalAppearance.monospacedFontFamilies()
        let stored = UserSettings.terminalFontName.value
        if !families.contains(stored) {
            families.insert(stored, at: 0)
        }

        let family = ComposableSettings.ChoiceViewModel<String>(
            title: "Font",
            setting: UserSettings.terminalFontName,
            choices: families.map { .init(label: $0, value: $0) }
        )
        group.addSettingSubview(ComposableSettings.PopupMenuChoiceView(viewModel: family))

        let size = ComposableSettings.RangeViewModel<Double>(
            title: "Size",
            setting: UserSettings.terminalFontSize,
            minValue: 9,
            maxValue: 24
        )
        group.addSettingSubview(
            ComposableSettings.CaptionedSliderView(viewModel: size) { "\(Int($0.rounded())) pt" }
        )

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
