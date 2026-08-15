import AppKit
import AgenticToolkitCore
import AgenticToolkitCoreMacOS

extension ComposableSettings {

    /// The detail pane's chrome: the selected panel on the left, a help button
    /// pinned to the panel's top-right corner, and the `HelpDrawerView` that
    /// button discloses on the right.
    ///
    /// One instance lives for the whole life of the split and only its *content*
    /// is swapped, because disclosure is a property of the window rather than of
    /// whichever panel happens to be showing — rebuilding the chrome per panel
    /// would re-run the open/close animation on every sidebar click.
    @MainActor
    public final class PanelHostView: NSView {

        /// Inset of the help button from the panel's top-right corner. Sits inside
        /// the panel's own content inset, so it lands in the empty gutter beside a
        /// group's leading-aligned header rather than on top of any control.
        private static let buttonInset: CGFloat = 12

        private static let disclosureDuration: TimeInterval = 0.18

        private let contentContainer = NSView()
        private let drawer = HelpDrawerView()
        private let helpButton = NSButton()

        private var drawerWidth: NSLayoutConstraint?
        private var themeObserver: ThemePaletteObserver?
        private let disclosure: UserSettingObserver<Bool>

        private var help: PanelHelp?

        /// Called whenever the drawer opens or closes. The split uses it to widen
        /// the detail pane's floor by the drawer's width, so disclosing help
        /// squeezes the window's minimum rather than the panel's controls.
        public var onDisclosureChange: (() -> Void)?

        /// The width the drawer is currently claiming — zero while collapsed.
        public var disclosedDrawerWidth: CGFloat {
            self.isDisclosed ? HelpDrawerView.disclosedWidth : 0
        }

        public init() {
            self.disclosure = UserSettingObserver(UserSettings.settingsHelpDrawerVisible)

            super.init(frame: .zero)
            self.translatesAutoresizingMaskIntoConstraints = false

            self.contentContainer.translatesAutoresizingMaskIntoConstraints = false
            self.addSubview(self.contentContainer)
            self.addSubview(self.drawer)
            // Added last so it floats above the panel's own content; it is a child
            // of `self`, not of the content, so swapping panels never disturbs it.
            self.configureHelpButton()
            self.addSubview(self.helpButton)

            let width = self.drawer.widthAnchor.constraint(equalToConstant: 0)
            self.drawerWidth = width
            NSLayoutConstraint.activate([
                self.contentContainer.topAnchor.constraint(equalTo: self.topAnchor),
                self.contentContainer.leadingAnchor.constraint(equalTo: self.leadingAnchor),
                self.contentContainer.bottomAnchor.constraint(equalTo: self.bottomAnchor),
                self.contentContainer.trailingAnchor.constraint(equalTo: self.drawer.leadingAnchor),

                self.drawer.topAnchor.constraint(equalTo: self.topAnchor),
                self.drawer.trailingAnchor.constraint(equalTo: self.trailingAnchor),
                self.drawer.bottomAnchor.constraint(equalTo: self.bottomAnchor),
                width,

                self.helpButton.topAnchor.constraint(
                    equalTo: self.contentContainer.topAnchor, constant: Self.buttonInset),
                self.helpButton.trailingAnchor.constraint(
                    equalTo: self.contentContainer.trailingAnchor, constant: -Self.buttonInset)
            ])

            self.disclosure.onChange = { [weak self] _ in
                self?.updateDisclosure(animated: true)
            }

            self.themeObserver = ThemePaletteObserver { [weak self] _ in
                self?.updateHelpButton()
            }

            self.updateDisclosure(animated: false)
        }

        @available(*, unavailable)
        public required init?(coder: NSCoder) { fatalError() }

        // MARK: - Content

        /// Installs the selected panel's view (or the scroll view wrapping it),
        /// replacing whatever was there. `nil` empties the pane.
        public func setContent(_ view: NSView?) {
            self.contentContainer.subviews.forEach { $0.removeFromSuperview() }
            guard let view else { return }
            view.translatesAutoresizingMaskIntoConstraints = false
            self.contentContainer.addSubview(view)
            Self.pinToEdges(view, of: self.contentContainer)
        }

        /// Sets the help for the panel now showing. `nil` retires the button and
        /// collapses the drawer without touching the remembered preference, so a
        /// panel that offers no help doesn't teach the window to stay shut.
        public func setHelp(_ help: PanelHelp?) {
            self.help = help
            self.drawer.setHelp(help)
            self.updateDisclosure(animated: false)
        }

        // MARK: - Disclosure

        private var isDisclosed: Bool {
            self.help != nil && self.disclosure.value
        }

        private func updateDisclosure(animated: Bool) {
            let disclosed = self.isDisclosed
            self.helpButton.isHidden = self.help == nil
            self.updateHelpButton()

            // Hidden rather than merely zero-width: a wrapping label asked to lay
            // out at zero width resolves to an absurd height, so leaving the
            // collapsed drawer visible would cost real layout on every pass.
            let target = disclosed ? HelpDrawerView.disclosedWidth : 0
            self.drawer.isHidden = !disclosed
            // Ahead of the animation: the pane's floor has to make room for the
            // drawer before it slides in, not after.
            self.onDisclosureChange?()

            guard animated else {
                self.drawerWidth?.constant = target
                return
            }
            NSAnimationContext.runAnimationGroup { context in
                context.duration = Self.disclosureDuration
                self.drawerWidth?.animator().constant = target
            }
        }

        // MARK: - Help button

        private func configureHelpButton() {
            self.helpButton.translatesAutoresizingMaskIntoConstraints = false
            self.helpButton.isBordered = false
            self.helpButton.imagePosition = .imageOnly
            self.helpButton.setButtonType(.momentaryChange)
            self.helpButton.target = self
            self.helpButton.action = #selector(self.toggleHelp)
            self.helpButton.setAccessibilityLabel("Help")
        }

        @objc private func toggleHelp() {
            self.disclosure.value.toggle()
        }

        private func updateHelpButton() {
            let disclosed = self.isDisclosed
            let palette = ThemePaletteObserver.currentPalette
            // Filled while open, outlined while closed — the button reports the
            // drawer's state as well as toggling it, which matters because the
            // drawer is remembered across launches.
            let symbol = disclosed ? "questionmark.circle.fill" : "questionmark.circle"
            let image = NSImage(systemSymbolName: symbol, accessibilityDescription: "Help")
            self.helpButton.image = image?.withSymbolConfiguration(
                NSImage.SymbolConfiguration(pointSize: 15, weight: .regular))
            self.helpButton.contentTintColor = disclosed
                ? palette.accentColor
                : palette.secondaryTextColor
            self.helpButton.toolTip = disclosed ? "Hide Help" : "Show Help"
        }
    }
}
