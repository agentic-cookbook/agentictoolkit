import AppKit
import AgenticToolkitCore

extension ComposableSettings {

    /// A compact, reusable "theme chooser + live sample": a popup of all themes
    /// bound to the active-theme setting, with a `ThemePreviewView` beneath it
    /// that tracks the active theme. Drop into any settings panel that wants a
    /// quick theme switch without the full editor.
    @MainActor
    public final class ThemePickerView: NSView, SettingsViewProtocol {

        private let popup: PopupMenuChoiceView<String>
        private let preview = ThemePreviewView()
        private var observer: ThemePaletteObserver?

        public init(store: ThemeStore = ThemeStore()) {
            self.popup = PopupMenuChoiceView(viewModel: ThemeChoiceViewModel(store: store))

            super.init(frame: .zero)
            self.translatesAutoresizingMaskIntoConstraints = false

            let stack = NSStackView(views: [self.popup, self.preview])
            stack.orientation = .vertical
            stack.alignment = .leading
            stack.spacing = 10
            stack.translatesAutoresizingMaskIntoConstraints = false
            self.addSubview(stack)
            Self.pinToEdges(stack, of: self)

            self.observer = ThemePaletteObserver { [weak self] palette in
                self?.preview.show(palette.theme)
            }
        }

        public required init?(coder: NSCoder) {
            fatalError("init(coder:) has not been implemented")
        }
    }
}
