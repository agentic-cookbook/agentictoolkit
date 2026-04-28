import AppKit

extension ComposableSettings {

    @MainActor
    public class DividerView: NSView {

        private let viewLayout: SettingsLayout

        public init(viewLayout: SettingsLayout = .default) {
            self.viewLayout = viewLayout
            super.init(frame: .zero)
            self.translatesAutoresizingMaskIntoConstraints = false
            self.wantsLayer = true
            NSLayoutConstraint.activate([
                self.heightAnchor.constraint(equalToConstant: viewLayout[.dividerThickness]),
            ])
        }

        public override init(frame frameRect: NSRect) {
            fatalError("init(frame frameRect: NSRect")
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
