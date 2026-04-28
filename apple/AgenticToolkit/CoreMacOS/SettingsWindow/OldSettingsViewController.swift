import AppKit

/// Split-pane settings container. Subclass and populate in `viewDidLoad` by
/// calling `addPanel(_:)`. Sidebar is a `OldSettingsPanelListViewController`; the
/// detail pane hosts the currently selected `OldSettingsPanelViewController`.
@MainActor
open class OldSettingsViewController: NSSplitViewController {

    public private(set) var panels: [OldSettingsPanelViewController] = []

    /// The sidebar list controller. Inject a subclass to customize row
    /// presentation; defaults to a stock `OldSettingsPanelListViewController`.
    public let listViewController: OldSettingsPanelListViewController

    private let detailContainer = NSViewController()

    public init(listViewController: OldSettingsPanelListViewController = OldSettingsPanelListViewController()) {
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

    public func addPanel(_ panel: OldSettingsPanelViewController) {
        panels.append(panel)
        listViewController.setPanels(panels)
    }

    public func removePanel(_ panel: OldSettingsPanelViewController) {
        panels.removeAll { $0 === panel }
        listViewController.setPanels(panels)
        if currentPanel === panel { show(nil) }
    }

    public func clear() {
        panels.removeAll()
        listViewController.setPanels(panels)
        show(nil)
    }

    public func selectPanel(_ panel: OldSettingsPanelViewController) {
        guard let index = panels.firstIndex(where: { $0 === panel }) else { return }
        selectPanel(at: index)
    }

    public func selectPanel(at index: Int) {
        guard panels.indices.contains(index) else { return }
        listViewController.selectPanel(at: index)
        show(panels[index])
    }

    // MARK: - Detail pane

    private var currentPanel: OldSettingsPanelViewController? {
        detailContainer.children.first as? OldSettingsPanelViewController
    }

    private func show(_ panel: OldSettingsPanelViewController?) {
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
