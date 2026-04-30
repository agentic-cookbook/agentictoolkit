import AppKit

extension ComposableSettings {

    /// Root container for a panel. Hosts a vertical stack of `GroupView`s with
    /// `DividerView`s between them, all inside the panel's content area.
    @MainActor
    open class PanelView: NSView, SettingsViewProtocol {

        private let stackView = NSStackView()

        public convenience init() {
            self.init(frame: .zero)
        }

        public override init(frame frameRect: NSRect) {
            super.init(frame: .zero)
            self.translatesAutoresizingMaskIntoConstraints = false

            self.stackView.orientation = .vertical
            self.stackView.spacing = SettingsLayout.default[.groupSpacing]
            self.stackView.alignment = .leading
            self.stackView.translatesAutoresizingMaskIntoConstraints = false
            self.addSubview(self.stackView)

            let inset = SettingsLayout.default[.panelInset]
            NSLayoutConstraint.activate([
                self.stackView.topAnchor.constraint(equalTo: self.topAnchor, constant: inset),
                self.stackView.leadingAnchor.constraint(equalTo: self.leadingAnchor, constant: inset),
                self.stackView.trailingAnchor.constraint(equalTo: self.trailingAnchor, constant: -inset),
                self.stackView.bottomAnchor.constraint(lessThanOrEqualTo: self.bottomAnchor, constant: -inset)
            ])
        }

        public required init?(coder: NSCoder) {
            fatalError("not overridden")
        }

        public func addGroup(_ group: GroupView) {
            if !self.stackView.arrangedSubviews.isEmpty {
                self.stackView.addArrangedSubview(DividerView())
            }
            self.stackView.addArrangedSubview(group)
        }

    }
}
