import AppKit
import AgenticToolkitCore
import AgenticToolkitCoreMacOS

extension ComposableSettings {

    /// The content of the help drawer: a fixed "Help" heading over an
    /// independently scrolling list of a panel's `PanelHelp` topics.
    ///
    /// The topics are ordinary `GroupView` + `ExplanationView` pairs — the same
    /// two views the panels themselves are built from — so help reads in the same
    /// type and rhythm as the settings it describes, and gains any future styling
    /// those views get for free.
    ///
    /// This is only the drawer's contents; the sliding, the edge it comes out of,
    /// and the window tracking belong to `HelpDrawerController`'s `NSDrawer`.
    @MainActor
    public final class HelpDrawerView: NSView {

        private let titleLabel = NSTextField(labelWithString: "Help")
        private let scrollView = PanelScrollView()

        private var themeObserver: ThemePaletteObserver?
        private var help: PanelHelp?

        public init() {
            super.init(frame: .zero)
            self.translatesAutoresizingMaskIntoConstraints = false
            self.wantsLayer = true

            self.titleLabel.translatesAutoresizingMaskIntoConstraints = false
            self.addSubview(self.titleLabel)
            self.addSubview(self.scrollView)

            let inset = SettingsLayout.default[.panelInset]
            NSLayoutConstraint.activate([
                self.titleLabel.topAnchor.constraint(equalTo: self.topAnchor, constant: inset),
                self.titleLabel.leadingAnchor.constraint(
                    equalTo: self.leadingAnchor, constant: inset),
                self.titleLabel.trailingAnchor.constraint(
                    lessThanOrEqualTo: self.trailingAnchor, constant: -inset),

                self.scrollView.topAnchor.constraint(equalTo: self.titleLabel.bottomAnchor),
                self.scrollView.leadingAnchor.constraint(equalTo: self.leadingAnchor),
                self.scrollView.trailingAnchor.constraint(equalTo: self.trailingAnchor),
                self.scrollView.bottomAnchor.constraint(equalTo: self.bottomAnchor)
            ])

            self.themeObserver = ThemePaletteObserver { [weak self] palette in
                self?.applyTheme(palette)
            }
        }

        @available(*, unavailable)
        public required init?(coder: NSCoder) { fatalError() }

        /// Replaces the drawer's contents. `nil` empties it — the controller
        /// closes the drawer in that case, but clearing keeps a stale panel's
        /// help from flashing back the next time it opens.
        public func setHelp(_ help: PanelHelp?) {
            self.help = help
            let panel = PanelView()
            for topic in help?.topics ?? [] {
                let group = GroupView(withTitle: topic.title)
                group.addSettingSubview(ExplanationView(withText: topic.body))
                panel.addGroup(group)
            }
            self.scrollView.setContent(panel)
        }

        private func applyTheme(_ palette: SemanticPalette) {
            self.layer?.backgroundColor = palette.surfaceColor.cgColor
            self.titleLabel.font = palette.font(.heading)
            self.titleLabel.textColor = palette.primaryTextColor
        }
    }
}
