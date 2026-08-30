import AppKit
import AgenticToolkitCore

extension ComposableSettings {

    /// A row showing the chosen font by name, drawn in that font, with a
    /// button that opens the system font panel.
    ///
    /// A popup of font *families* cannot express the choice at all once Nerd
    /// Font patches are installed — a dozen faces share one family name — so
    /// this defers to the panel macOS already ships (`native-controls`) rather
    /// than growing a second font browser.
    @MainActor
    public final class FontPickerView: NSView, SettingsViewProtocol, NSFontChanging {

        public let label: NSTextField
        public let sampleLabel: NSTextField
        public let button: NSButton

        private let viewModel: FontViewModel

        public init(viewModel: FontViewModel) {
            self.viewModel = viewModel
            self.label = ComposableSettings.makeRowLabel(viewModel.title)
            self.sampleLabel = ComposableSettings.makeValueLabel()
            self.button = NSButton(title: "Choose…", target: nil, action: nil)

            super.init(frame: .zero)
            self.translatesAutoresizingMaskIntoConstraints = false

            self.button.bezelStyle = .rounded
            self.button.target = self
            self.button.action = #selector(chooseFont(_:))
            self.button.accessibilityID("settings.font-picker.choose")

            self.sampleLabel.lineBreakMode = .byTruncatingTail
            self.sampleLabel.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
            self.sampleLabel.setContentHuggingPriority(.defaultLow, for: .horizontal)

            let row = Self.makeRow([self.label, self.sampleLabel, self.button])
            self.addSubview(row)
            Self.pinToEdges(row, of: self)

            viewModel.onChange = { [weak self] _ in self?.sync() }
            self.sync()
        }

        public override init(frame frameRect: NSRect) {
            fatalError("init(frame frameRect: NSRect)")
        }

        required init?(coder: NSCoder) {
            fatalError("init(coder:) has not been implemented")
        }

        /// Grays out the whole row. Used by panels where the font is only
        /// editable while some other switch is on.
        public var isEnabled: Bool = true {
            didSet {
                button.isEnabled = isEnabled
                label.alphaValue = isEnabled ? 1 : 0.4
                sampleLabel.alphaValue = isEnabled ? 1 : 0.4
            }
        }

        private func sync() {
            let font = viewModel.font
            label.stringValue = viewModel.title
            // Drawn in the font itself: the whole reason for a real picker is
            // seeing which of the near-identical variants you actually picked.
            sampleLabel.font = font
            sampleLabel.stringValue = Self.describe(font, installed: viewModel.isInstalled)
        }

        private static func describe(_ font: NSFont, installed: Bool) -> String {
            let name = font.displayName ?? font.fontName
            let size = Int(font.pointSize.rounded())
            return installed ? "\(name) — \(size) pt" : "\(name) — \(size) pt (not installed)"
        }

        @objc private func chooseFont(_ sender: NSButton) {
            let manager = NSFontManager.shared
            manager.target = self
            manager.setSelectedFont(viewModel.font, isMultiple: false)
            manager.orderFrontFontPanel(self)
        }

        // MARK: - NSFontChanging

        public func changeFont(_ sender: NSFontManager?) {
            guard let sender else { return }
            viewModel.setFont(sender.convert(viewModel.font))
            sync()
        }

        /// Only the parts of the panel that pick a font — the color and
        /// underline effects would write nothing anyone reads back.
        public func validModesForFontPanel(_ fontPanel: NSFontPanel) -> NSFontPanel.ModeMask {
            [.collection, .face, .size]
        }
    }
}
