import AppKit

extension ComposableSettings {

    @MainActor
    public class GroupView: NSView, SettingsViewProtocol {

        private let stackView: NSStackView

        public init(withTitle title: String) {
            self.stackView = NSStackView()

            super.init(frame: .zero)
            self.translatesAutoresizingMaskIntoConstraints = false
            self.stackView.translatesAutoresizingMaskIntoConstraints = false
            self.addSubview(self.stackView)
            Self.pinToEdges(self.stackView, of: self)

            self.stackView.orientation = .vertical
            self.stackView.alignment = .leading

            self.addSettingSubview(HeaderView(title: title))
        }

        public required init?(coder: NSCoder) {
            fatalError("init(coder:) has not been implemented")
        }

        // Each group fills its parent stack's width so that any child that
        // wants to span the full panel (sliders with trailing captions, dividers,
        // etc.) actually can. Items inside the group still control their own
        // horizontal layout via content-hugging priorities.
        public override func viewDidMoveToSuperview() {
            super.viewDidMoveToSuperview()
            guard let parent = self.superview else { return }
            self.widthAnchor.constraint(equalTo: parent.widthAnchor).isActive = true
        }

        public func addSettingSubview(_ view: NSView) {
            stackView.addArrangedSubview(view)
        }
    }
}
