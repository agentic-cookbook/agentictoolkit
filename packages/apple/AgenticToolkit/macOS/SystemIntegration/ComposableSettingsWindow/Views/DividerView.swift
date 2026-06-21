import AppKit
import AgenticToolkitCore
import AgenticToolkitCoreMacOS

extension ComposableSettings {

    @MainActor
    public class DividerView: NSView, SettingsViewProtocol {

        private var themeObserver: ThemePaletteObserver?

        public convenience init() {
            self.init(frame: .zero)
        }

        public override init(frame frameRect: NSRect) {
            super.init(frame: .zero)

            self.translatesAutoresizingMaskIntoConstraints = false
            self.wantsLayer = true
            NSLayoutConstraint.activate([
                self.heightAnchor.constraint(equalToConstant: SettingsLayout.default[.dividerThickness])
            ])

            themeObserver = ThemePaletteObserver { [weak self] palette in
                self?.layer?.backgroundColor = palette.dividerColor.cgColor
            }
        }

        required init?(coder: NSCoder) {
            fatalError("init(coder:) has not been implemented")
        }

        public override func updateLayer() {
            super.updateLayer()
            self.layer?.backgroundColor = ThemePaletteObserver.currentPalette.dividerColor.cgColor
        }
    }
}
