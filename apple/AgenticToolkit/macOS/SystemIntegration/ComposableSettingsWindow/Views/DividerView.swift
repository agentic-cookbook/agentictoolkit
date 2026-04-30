import AppKit

extension ComposableSettings {

    @MainActor
    public class DividerView: NSView, SettingsViewProtocol {

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
        }

        required init?(coder: NSCoder) {
            fatalError("init(coder:) has not been implemented")
        }

        public override func updateLayer() {
            super.updateLayer()
            self.layer?.backgroundColor = NSColor.separatorColor.cgColor
        }
    }
}
