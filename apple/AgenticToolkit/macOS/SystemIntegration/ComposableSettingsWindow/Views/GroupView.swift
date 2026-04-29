import AppKit

extension ComposableSettings {

    @MainActor
    public class GroupView: NSStackView {

        private let viewLayout: SettingsLayout

        public init(withTitle title: String, viewLayout: SettingsLayout = .default) {
            self.viewLayout = viewLayout
            super.init(frame: .zero)
            self.translatesAutoresizingMaskIntoConstraints = false

            self.orientation = .vertical
            self.spacing = viewLayout[.groupSpacing]
            self.alignment = .leading
            self.addArrangedSubview(HeaderView(title: title, viewLayout: viewLayout))
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
    }
}
