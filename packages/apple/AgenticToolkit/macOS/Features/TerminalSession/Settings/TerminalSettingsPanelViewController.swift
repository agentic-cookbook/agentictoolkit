import AppKit

import AgenticToolkitCore

/// Settings panel for the terminal's layout, font and caret.
///
/// There is deliberately no color section: terminal colors are the app theme's,
/// edited in Theme settings, so there is one palette rather than two that drift
/// (`dry`).
@MainActor
public final class TerminalSettingsPanelViewController: ComposableSettings.SettingsPanelViewController {

    /// `CheckboxView` claims its view model's `onChange` for itself, so the
    /// font row's enablement needs an observer of its own rather than a second
    /// consumer of that one.
    private var usesThemeFontObserver: UserSettingObserver<Bool>?
    private var fontPicker: ComposableSettings.FontPickerView?

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
        let group = ComposableSettings.GroupView(withTitle: "Padding")

        group.addSettingSubview(ComposableSettings.ExplanationView(
            withText: "Space between the terminal text and the edge of its pane, in points."
        ))

        let sides: [(String, UserSetting<Int>)] = [
            ("Top", UserSettings.terminalPaddingTop),
            ("Left", UserSettings.terminalPaddingLeading),
            ("Bottom", UserSettings.terminalPaddingBottom),
            ("Right", UserSettings.terminalPaddingTrailing)
        ]

        let row = ComposableSettings.HorizontalStackView()
        for (title, setting) in sides {
            let viewModel = ComposableSettings.RangeViewModel<Int>(
                title: title,
                setting: setting,
                minValue: 0,
                maxValue: 80
            )
            row.addArrangedSubview(ComposableSettings.IntegerFieldView(viewModel: viewModel))
        }
        group.addSettingSubview(row)

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

        let fontViewModel = ComposableSettings.FontViewModel(
            title: "Terminal font",
            nameSetting: UserSettings.terminalFontName,
            sizeSetting: UserSettings.terminalFontSize
        )
        let picker = ComposableSettings.FontPickerView(viewModel: fontViewModel)
        picker.isEnabled = !UserSettings.terminalUsesThemeFont.value
        group.addSettingSubview(picker)
        fontPicker = picker

        usesThemeFontObserver = UserSettingObserver(UserSettings.terminalUsesThemeFont) { [weak self] usesTheme in
            self?.fontPicker?.isEnabled = !usesTheme
        }

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
