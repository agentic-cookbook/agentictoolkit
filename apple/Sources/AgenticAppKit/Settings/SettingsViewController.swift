import AppKit

/// A split-pane settings container.
///
/// Hosts a list of `SettingsPanelViewController`s in a left sidebar and shows
/// the selected panel's content on the right. Panels are added/removed
/// dynamically by the host.
@MainActor
public final class SettingsViewController: NSViewController {

    // MARK: - Panel Storage

    private var storedPanels: [any SettingsPanelViewController] = []

    /// Read-only snapshot of the current panel list, in insertion order.
    public var panels: [any SettingsPanelViewController] { storedPanels }

    // MARK: - Child Controllers

    private let splitViewController = NSSplitViewController()
    private let listViewController = SettingsPanelListViewController()
    private let editViewController = SettingsPanelEditViewController()

    // MARK: - Lifecycle

    public init() {
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    public required init?(coder: NSCoder) { fatalError() }

    public override func loadView() {
        self.view = NSView(frame: NSRect(x: 0, y: 0, width: 640, height: 480))
    }

    public override func viewDidLoad() {
        super.viewDidLoad()

        let listItem = NSSplitViewItem(sidebarWithViewController: listViewController)
        listItem.minimumThickness = 180
        listItem.maximumThickness = 220

        let editItem = NSSplitViewItem(viewController: editViewController)

        splitViewController.addSplitViewItem(listItem)
        splitViewController.addSplitViewItem(editItem)

        addChild(splitViewController)
        splitViewController.view.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(splitViewController.view)
        NSLayoutConstraint.activate([
            splitViewController.view.topAnchor.constraint(equalTo: view.topAnchor),
            splitViewController.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            splitViewController.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            splitViewController.view.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])

        listViewController.onSelect = { [weak self] panel in
            self?.editViewController.show(panel)
        }
    }

    // MARK: - Mutation

    public func addPanel(_ panel: any SettingsPanelViewController) {
        storedPanels.append(panel)
        listViewController.setPanels(storedPanels)
    }

    public func removePanel(_ panel: any SettingsPanelViewController) {
        storedPanels.removeAll { $0 === panel }
        listViewController.setPanels(storedPanels)
        if editViewController.currentPanel === panel {
            editViewController.show(nil)
        }
    }

    public func clear() {
        storedPanels.removeAll()
        listViewController.setPanels(storedPanels)
        editViewController.show(nil)
    }
}
