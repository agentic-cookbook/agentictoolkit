import AppKit

extension ComposableSettings {
    
    /// Split-pane settings container. Subclass and populate in `viewDidLoad` by
    /// calling `addPanel(_:)`. Sidebar is a `PanelListViewController`; the
    /// detail pane hosts the currently selected `any ComposableSettingsPanel`.
    @MainActor
    open class SplitViewController: NSSplitViewController {
        
        public private(set) var panels: [any ComposableSettingsPanel] = []
        
        /// The sidebar list controller. Inject a subclass to customize row
        /// presentation; defaults to a stock `PanelListViewController`.
        public let listViewController: PanelListViewController
        
        private let detailContainer = NSViewController()
        
        public init(listViewController: PanelListViewController = PanelListViewController()) {
            self.listViewController = listViewController
            super.init(nibName: nil, bundle: nil)
        }
        
        @available(*, unavailable)
        public required init?(coder: NSCoder) { fatalError() }
        
        open override func viewDidLoad() {
            super.viewDidLoad()
            
            detailContainer.view = NSView()
            
            let sidebarItem = NSSplitViewItem(sidebarWithViewController: listViewController)
            sidebarItem.minimumThickness = 180
            sidebarItem.maximumThickness = 220
            addSplitViewItem(sidebarItem)
            addSplitViewItem(NSSplitViewItem(viewController: detailContainer))
            
            listViewController.onSelectPanel = { [weak self] panel in
                self?.show(panel)
            }
        }
        
        open override func viewWillAppear() {
            super.viewWillAppear()
            // Auto-select the first panel so the detail pane is never blank.
            if currentPanel == nil, let first = panels.first {
                selectPanel(first)
            }
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
            panel.view.translatesAutoresizingMaskIntoConstraints = false
            detailContainer.view.addSubview(panel.view)
            NSLayoutConstraint.activate([
                panel.view.topAnchor.constraint(equalTo: detailContainer.view.topAnchor),
                panel.view.leadingAnchor.constraint(equalTo: detailContainer.view.leadingAnchor),
                panel.view.trailingAnchor.constraint(equalTo: detailContainer.view.trailingAnchor),
                panel.view.bottomAnchor.constraint(equalTo: detailContainer.view.bottomAnchor),
            ])
        }
    }
}
