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
    }
}
