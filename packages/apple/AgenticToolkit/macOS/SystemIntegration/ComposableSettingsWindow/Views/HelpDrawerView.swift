import AppKit
import AgenticToolkitCore
import AgenticToolkitCoreMacOS

extension ComposableSettings {

    /// The right-hand drawer that renders a panel's `PanelHelp`: a fixed "Help"
    /// heading over an independently scrolling list of topics.
    ///
    /// The topics are ordinary `GroupView` + `ExplanationView` pairs — the same
    /// two views the panels themselves are built from — so help reads in the same
    /// type and rhythm as the settings it describes, and gains any future styling
    /// those views get for free.
    @MainActor
    public final class HelpDrawerView: NSView {

        /// Width when disclosed. Wide enough for a comfortable measure at the
        /// 11pt explanation size, narrow enough that the controls keep the
        /// majority of a default-width settings window.
        public static let disclosedWidth: CGFloat = 280

        private let titleLabel = NSTextField(labelWithString: "Help")
        private let scrollView = PanelScrollView()
        private let leadingDivider = NSView()

        private var themeObserver: ThemePaletteObserver?
        private var help: PanelHelp?

        public init() {
            super.init(frame: .zero)
            self.translatesAutoresizingMaskIntoConstraints = false
            self.wantsLayer = true
            // The disclosure animates this view's width to zero; without clipping,
            // its content would spill over the panel on the way in and out.
            self.clipsToBounds = true

            self.leadingDivider.translatesAutoresizingMaskIntoConstraints = false
            self.leadingDivider.wantsLayer = true
            self.addSubview(self.leadingDivider)

            self.titleLabel.translatesAutoresizingMaskIntoConstraints = false
            self.addSubview(self.titleLabel)

            self.addSubview(self.scrollView)

            let inset = SettingsLayout.default[.panelInset]
            NSLayoutConstraint.activate([
                self.leadingDivider.leadingAnchor.constraint(equalTo: self.leadingAnchor),
                self.leadingDivider.topAnchor.constraint(equalTo: self.topAnchor),
                self.leadingDivider.bottomAnchor.constraint(equalTo: self.bottomAnchor),
                self.leadingDivider.widthAnchor.constraint(
                    equalToConstant: SettingsLayout.default[.dividerThickness]),

                self.titleLabel.topAnchor.constraint(equalTo: self.topAnchor, constant: inset),
                self.titleLabel.leadingAnchor.constraint(
                    equalTo: self.leadingDivider.trailingAnchor, constant: inset),
                self.titleLabel.trailingAnchor.constraint(
                    lessThanOrEqualTo: self.trailingAnchor, constant: -inset),

                self.scrollView.topAnchor.constraint(equalTo: self.titleLabel.bottomAnchor),
                self.scrollView.leadingAnchor.constraint(equalTo: self.leadingDivider.trailingAnchor),
                self.scrollView.trailingAnchor.constraint(equalTo: self.trailingAnchor),
                self.scrollView.bottomAnchor.constraint(equalTo: self.bottomAnchor)
            ])

            self.themeObserver = ThemePaletteObserver { [weak self] palette in
                self?.applyTheme(palette)
            }
        }

        @available(*, unavailable)
        public required init?(coder: NSCoder) { fatalError() }

        /// Replaces the drawer's contents. `nil` empties it — the container hides
        /// the whole drawer in that case, but clearing keeps a stale panel's help
        /// from flashing back if it is ever disclosed again.
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
            self.leadingDivider.layer?.backgroundColor = palette.dividerColor.cgColor
            self.titleLabel.font = palette.font(.heading)
            self.titleLabel.textColor = palette.primaryTextColor
        }
    }
}
