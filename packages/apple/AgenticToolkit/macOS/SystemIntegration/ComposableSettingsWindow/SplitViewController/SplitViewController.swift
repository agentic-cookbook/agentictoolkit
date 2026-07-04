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

        /// Autosave name for the sidebar divider, so the user's chosen topic-list
        /// width persists across launches. Each split needs a distinct name;
        /// nested splits override this with one keyed on their panel.
        open var sidebarAutosaveName: String? { "ComposableSettings.RootSidebar" }

        /// The sidebar list controller. Inject a subclass to customize row
        /// presentation; defaults to a stock `PanelListViewController`.
        public let listViewController: PanelListViewController

        private let detailContainer = NSViewController()

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

            let detailView = NSView()
            detailView.wantsLayer = true
            detailContainer.view = detailView

            let sidebarItem = NSSplitViewItem(sidebarWithViewController: listViewController)
            // A generous thickness band so the divider is freely user-draggable;
            // the detail's own minimumThickness keeps it from being squeezed away.
            sidebarItem.minimumThickness = 160
            sidebarItem.maximumThickness = 360
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

            // Persist the divider position (the user's chosen topic-list width).
            // Set *after* the items exist so NSSplitView associates the saved frames
            // with them — set earlier, drags aren't captured and nothing restores.
            splitView.autosaveName = sidebarAutosaveName

            listViewController.onSelectPanel = { [weak self] panel in
                self?.show(panel)
            }

            themeObserver = ThemePaletteObserver { [weak self] palette in
                self?.applyTheme(palette)
            }
        }

        open override func viewWillAppear() {
            super.viewWillAppear()
            // Auto-select the first panel so the detail pane is never blank.
            if currentPanel == nil, let first = panels.first {
                selectPanel(first)
            }
        }

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
        }

        public func addPanel(_ panel: any ComposableSettingsPanel) {
            panels.append(panel)
            listViewController.setPanels(panels)
        }

        public func removePanel(_ panel: any ComposableSettingsPanel) {
            panels.removeAll { $0 === panel }
            listViewController.setPanels(panels)
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
                child.view.removeFromSuperview()
                child.removeFromParent()
            }
            guard let panel else { return }
            detailContainer.addChild(panel)
            let container = detailContainer.view
            panel.view.translatesAutoresizingMaskIntoConstraints = false

            // Nested splits manage their own layout and self-scrolling panels
            // scroll themselves — both are hosted directly. Every other panel is
            // wrapped in a scroll view whose document fills the viewport width and
            // scrolls vertically (the canonical NSScrollView + Auto Layout setup),
            // so content fills the detail, wrapping labels wrap, tall content
            // scrolls, and the content's fitting size never drives the window — its
            // size is the user's alone.
            if panel is SplitViewController || panel.hostsOwnScroll {
                container.addSubview(panel.view)
                NSLayoutConstraint.activate([
                    panel.view.topAnchor.constraint(equalTo: container.topAnchor),
                    panel.view.leadingAnchor.constraint(equalTo: container.leadingAnchor),
                    panel.view.trailingAnchor.constraint(equalTo: container.trailingAnchor),
                    panel.view.bottomAnchor.constraint(equalTo: container.bottomAnchor)
                ])
                return
            }

            let scroll = NSScrollView()
            scroll.translatesAutoresizingMaskIntoConstraints = false
            scroll.drawsBackground = false
            scroll.hasVerticalScroller = true
            scroll.hasHorizontalScroller = true
            scroll.autohidesScrollers = true

            let document = FlippedDocumentView()
            document.translatesAutoresizingMaskIntoConstraints = false
            document.addSubview(panel.view)
            scroll.documentView = document
            container.addSubview(scroll)

            let clip = scroll.contentView
            NSLayoutConstraint.activate([
                scroll.topAnchor.constraint(equalTo: container.topAnchor),
                scroll.leadingAnchor.constraint(equalTo: container.leadingAnchor),
                scroll.trailingAnchor.constraint(equalTo: container.trailingAnchor),
                scroll.bottomAnchor.constraint(equalTo: container.bottomAnchor),

                document.topAnchor.constraint(equalTo: clip.topAnchor),
                document.leadingAnchor.constraint(equalTo: clip.leadingAnchor),

                panel.view.topAnchor.constraint(equalTo: document.topAnchor),
                panel.view.leadingAnchor.constraint(equalTo: document.leadingAnchor),
                panel.view.trailingAnchor.constraint(equalTo: document.trailingAnchor),
                panel.view.bottomAnchor.constraint(equalTo: document.bottomAnchor),

                // Exactly the viewport width (content fills + wrapping labels wrap;
                // wider content is clipped, never resizing the window) and at least
                // the viewport height (fills, or scrolls vertically when taller).
                panel.view.widthAnchor.constraint(equalTo: clip.widthAnchor),
                panel.view.heightAnchor.constraint(greaterThanOrEqualTo: clip.heightAnchor)
            ])
        }
    }
}

/// Flipped so a scroll view's document top-aligns its content (settings read
/// top-to-bottom) instead of AppKit's default bottom-up origin.
private final class FlippedDocumentView: NSView {
    override var isFlipped: Bool { true }
}
