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

        /// Required minimum width for a scroll-wrapped detail panel, so the window
        /// holds a usable size across panel switches. Nested splits override this
        /// to 0 (their leaves must not each re-impose the outer floor, which would
        /// cascade the window ever wider).
        open var detailFloorWidth: CGFloat { 560 }

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
            sidebarItem.minimumThickness = 180
            sidebarItem.maximumThickness = 220
            // The topic list must never auto-hide — it's the only way to switch
            // panels, so a collapse (from a narrow window or the toolbar toggle)
            // would strand the user in the detail pane.
            sidebarItem.canCollapse = false
            addSplitViewItem(sidebarItem)
            addSplitViewItem(NSSplitViewItem(viewController: detailContainer))

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

            // Nested splits, self-scrolling panels, and — when this split opts out
            // via `detailFloorWidth == 0` (nested splits) — every panel are hosted
            // directly so their wrapping labels wrap to the detail width and their
            // controls fill it. Otherwise (the top-level settings split) each panel
            // is wrapped in a scroll view so oversized content (long paths, wide
            // grids, tall forms) scrolls instead of resizing the window — the window
            // is the user's to size, never the content's.
            if panel is SplitViewController || panel.hostsOwnScroll || detailFloorWidth <= 0 {
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

                // Fill the viewport, but let bigger content overflow into a scroll
                // rather than pushing the window's size.
                panel.view.widthAnchor.constraint(greaterThanOrEqualTo: clip.widthAnchor),
                panel.view.heightAnchor.constraint(greaterThanOrEqualTo: clip.heightAnchor),

                // A required floor on the detail width so the window holds a usable
                // size (this constraint IS respected, unlike window.minSize which
                // NSSplitViewController overrides when it fits itself to content).
                // Content wider than this scrolls; the window never shrinks below it.
                panel.view.widthAnchor.constraint(greaterThanOrEqualToConstant: detailFloorWidth)
            ])
        }
    }
}

/// Flipped so a scroll view's document top-aligns its content (settings read
/// top-to-bottom) instead of AppKit's default bottom-up origin.
private final class FlippedDocumentView: NSView {
    override var isFlipped: Bool { true }
}
