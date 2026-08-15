import AppKit
import AgenticToolkitCore
import AgenticToolkitCoreMacOS

extension ComposableSettings {

    /// Split-pane settings container. Subclass and populate in `viewDidLoad` by
    /// calling `addPanel(_:)`. Sidebar is a `PanelListViewController`; the
    /// detail pane hosts the currently selected `any ComposableSettingsPanel`.
    @MainActor
    open class SplitViewController: NSSplitViewController {

        public private(set) var panels: [any ComposableSettingsPanel] = []

        /// Minimum width of the detail pane. This is the proper lever for the
        /// window's minimum width (window min = sidebar thickness + this) — it lets
        /// the detail grow freely, unlike a required width constraint on the content,
        /// which pins the window. Nested splits override it to 0 so they never
        /// re-impose the outer floor.
        open var detailMinimumThickness: CGFloat { 400 }

        /// Autosave name for the sidebar divider, so a draggable topic list
        /// persists its width. Only consulted when `contentSizedSidebar` is false.
        open var sidebarAutosaveName: String? { "ComposableSettings.RootSidebar" }

        /// When true, the sidebar is pinned to its content width (every title
        /// disclosed, never draggable, so switching panels never shifts the
        /// layout); when false it's the classic draggable band with autosave.
        ///
        /// Default false: the full-height *root* window sidebar keeps the draggable
        /// behaviour (its outline's column-fill misbehaves under a fixed width).
        /// Nested topic/detail splits opt in — they're the ones that visibly
        /// "move around" as you switch between them.
        open var contentSizedSidebar: Bool { false }

        /// Whether the detail pane carries the help button and its drawer. True
        /// for the root settings split; nested topic/detail splits turn it off so
        /// a panel's help opens once, at the window's right edge, instead of once
        /// per level of nesting.
        open var providesHelpDrawer: Bool { true }

        /// External floor for the sidebar thickness. A parent split sets this on
        /// its nested-split panels so their sibling topic lists share one width —
        /// switching between panels then never moves the inner divider. `nil`
        /// sizes purely to this list's own content. Only used when
        /// `contentSizedSidebar` is true.
        open var minimumSidebarWidthOverride: CGFloat? {
            didSet { applySidebarWidth() }
        }

        /// The sidebar list controller. Inject a subclass to customize row
        /// presentation; defaults to a stock `PanelListViewController`.
        public let listViewController: PanelListViewController

        /// Title shown as a header above the sidebar's topic list; nil hides it.
        /// Forwards to the list controller, so it can be set before or after the
        /// view loads. The root settings window sets "Settings"; nested
        /// topic/detail panels default it to their own panel title.
        public var sidebarTitle: String? {
            didSet { if isViewLoaded { listViewController.setTitle(sidebarTitle) } }
        }

        private let detailContainer = NSViewController()

        /// The detail pane's persistent chrome — panel content plus the help
        /// button and drawer. Outlives every panel switch, so the drawer's
        /// disclosure never re-animates just because the selection moved.
        private let panelHost = PanelHostView()

        // Repaints the window chrome and detail pane on every theme change.
        private var themeObserver: ThemePaletteObserver?

        public init(listViewController: PanelListViewController = PanelListViewController()) {
            self.listViewController = listViewController
            super.init(nibName: nil, bundle: nil)
        }

        @available(*, unavailable)
        public required init?(coder: NSCoder) { fatalError() }

        open override func viewDidLoad() {
            super.viewDidLoad()

            listViewController.setTitle(sidebarTitle)

            let detailView = NSView()
            detailView.wantsLayer = true
            detailContainer.view = detailView
            detailView.addSubview(panelHost)
            NSView.pinToEdges(panelHost, of: detailView)

            let sidebarItem = NSSplitViewItem(sidebarWithViewController: listViewController)
            // The topic list must never auto-hide — it's the only way to switch
            // panels, so a collapse (from a narrow window or the toolbar toggle)
            // would strand the user in the detail pane.
            sidebarItem.canCollapse = false
            // Higher holding priority than the detail so, on window resize, the
            // detail absorbs the change and the sidebar keeps its width.
            sidebarItem.holdingPriority = .defaultLow + 1
            addSplitViewItem(sidebarItem)

            let detailItem = NSSplitViewItem(viewController: detailContainer)
            detailItem.minimumThickness = detailMinimumThickness
            detailItem.holdingPriority = .defaultLow
            addSplitViewItem(detailItem)

            if contentSizedSidebar {
                // Content-sized, fixed-width sidebar: exactly as wide as the widest
                // row needs (every title disclosed) and never draggable, so
                // switching panels never shifts the layout. No autosave — the width
                // is derived from content, not a remembered drag.
                applySidebarWidth()
            } else {
                // Classic draggable band, width persisted via autosave.
                sidebarItem.minimumThickness = 160
                sidebarItem.maximumThickness = 360
                splitView.autosaveName = sidebarAutosaveName
            }

            listViewController.onSelectPanel = { [weak self] panel in
                self?.show(panel)
            }

            panelHost.onDisclosureChange = { [weak self] in
                self?.applyDetailMinimumThickness()
            }
            applyDetailMinimumThickness()

            themeObserver = ThemePaletteObserver { [weak self] palette in
                self?.applyTheme(palette)
            }
        }

        open override func viewWillAppear() {
            super.viewWillAppear()
            updateSidebarLayout()
            // Auto-select the first panel so the detail pane is never blank.
            if currentPanel == nil, let first = panels.first {
                selectPanel(first)
            }
        }

        /// Re-unifies sibling nested sidebars and re-pins this split's own sidebar.
        /// Called on appearance and whenever the panel set changes, so panels added
        /// while the window is already open still share one width (rather than the
        /// new split sizing to its own content while its siblings keep the old one).
        private func updateSidebarLayout() {
            unifyNestedSidebars()
            applySidebarWidth()
        }

        /// Pins the content-sized sidebar to a single width (min == max), so the
        /// topic list fully discloses its rows and can never be dragged.
        private func applySidebarWidth() {
            guard contentSizedSidebar, isViewLoaded, let sidebarItem = splitViewItems.first else { return }
            // When a parent has unified sibling widths, `minimumSidebarWidthOverride`
            // is already the authoritative (widest) width, so use it directly rather
            // than re-measuring this list. Capped so a pathologically long row
            // truncates instead of blowing out the sidebar (and the window minimum).
            let width = min(minimumSidebarWidthOverride ?? listViewController.preferredWidth(),
                            Self.maximumContentSidebarWidth)
            sidebarItem.minimumThickness = width
            sidebarItem.maximumThickness = width
        }

        /// When this split's panels are themselves nested splits (siblings that
        /// swap into the detail slot), give them all one width — the widest any of
        /// their topic lists needs — so switching between them never moves the
        /// inner divider. Force-loads each so its list is populated enough to
        /// report a content width (they otherwise load lazily on first show).
        private func unifyNestedSidebars() {
            let nested = panels.compactMap { $0 as? SplitViewController }
            guard nested.count > 1 else { return }
            let widest = min(
                nested.map { split -> CGFloat in
                    _ = split.view
                    return split.listViewController.preferredWidth()
                }.max() ?? 0,
                Self.maximumContentSidebarWidth)
            for split in nested {
                split.minimumSidebarWidthOverride = widest
            }
            // Widen the detail pane hosting these nested splits so the widest one
            // (its now-fixed sidebar + its own detail floor) can't be squeezed
            // below that floor at the window's minimum size; this lifts the
            // window's effective minimum width to fit the content instead.
            nestedDetailFloor = nested.map { widest + $0.detailMinimumThickness }.max() ?? 0
            applyDetailMinimumThickness()
        }

        /// Floor the nested splits need, or 0 when this split hosts none. Kept
        /// apart from the drawer's contribution so the two writers can't clobber
        /// each other — `applyDetailMinimumThickness` is the only one that sets
        /// the item's thickness.
        private var nestedDetailFloor: CGFloat = 0

        /// The detail item's floor: whatever the content needs, plus the drawer's
        /// width while it is open. Adding it here is what makes disclosing help
        /// push the window's minimum width out rather than crush the controls
        /// into the leftover sliver.
        private func applyDetailMinimumThickness() {
            guard isViewLoaded else { return }
            splitViewItems.last?.minimumThickness =
                max(detailMinimumThickness, nestedDetailFloor) + panelHost.disclosedDrawerWidth
        }

        /// Upper bound on a content-sized sidebar, so one unusually long row
        /// truncates rather than pushing the window's minimum width arbitrarily wide.
        private static let maximumContentSidebarWidth: CGFloat = 480

        private func applyTheme(_ palette: SemanticPalette) {
            // Window background follows the theme so the title bar and
            // overall chrome don't stay system-dark when a light theme is active.
            view.window?.backgroundColor = palette.windowBackgroundColor
            // Detail pane uses a slightly elevated surface to visually
            // separate it from the sidebar.
            detailContainer.view.layer?.backgroundColor = palette.surfaceColor.cgColor
        }

        // MARK: - Panel management

        public func setPanels(_ panels: [any ComposableSettingsPanel]) {
            self.panels = panels
            listViewController.setPanels(panels)
            updateSidebarLayout()
        }

        public func addPanel(_ panel: any ComposableSettingsPanel) {
            panels.append(panel)
            listViewController.setPanels(panels)
            updateSidebarLayout()
        }

        public func removePanel(_ panel: any ComposableSettingsPanel) {
            panels.removeAll { $0 === panel }
            listViewController.setPanels(panels)
            updateSidebarLayout()
            if currentPanel === panel { show(nil) }
        }

        public func clear() {
            panels.removeAll()
            listViewController.setPanels(panels)
            show(nil)
        }

        public func selectPanel(_ panel: any ComposableSettingsPanel) {
            guard let index = panels.firstIndex(where: { $0 === panel }) else { return }
            selectPanel(at: index)
        }

        public func selectPanel(at index: Int) {
            guard panels.indices.contains(index) else { return }
            listViewController.selectPanel(at: index)
            show(panels[index])
        }

        // MARK: - Detail pane

        private var currentPanel: (any ComposableSettingsPanel)? {
            detailContainer.children.first as? any ComposableSettingsPanel
        }

        private func show(_ panel: (any ComposableSettingsPanel)?) {
            for child in detailContainer.children {
                child.removeFromParent()
            }
            // `setContent` drops every hosted view. A scroll-wrapped panel's view
            // lives inside a wrapper NSScrollView (added below), so removing only
            // the panel's own view would orphan that wrapper on each switch.
            guard let panel else {
                panelHost.setContent(nil)
                panelHost.setHelp(nil)
                applyDetailMinimumThickness()
                return
            }
            detailContainer.addChild(panel)
            panel.view.translatesAutoresizingMaskIntoConstraints = false

            // Nested splits manage their own layout and self-scrolling panels
            // scroll themselves — both are hosted directly. Every other panel is
            // wrapped in a `PanelScrollView`, so content fills the detail,
            // wrapping labels wrap, tall content scrolls, and the content's
            // fitting size never drives the window — its size is the user's alone.
            if panel is SplitViewController || panel.hostsOwnScroll {
                panelHost.setContent(panel.view)
            } else {
                let scroll = PanelScrollView()
                scroll.setContent(panel.view)
                panelHost.setContent(scroll)
            }

            panelHost.setHelp(providesHelpDrawer ? panel.helpContent : nil)
            applyDetailMinimumThickness()
        }
    }
}
