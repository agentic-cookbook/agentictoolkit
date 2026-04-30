import AppKit

/// A tabs-on-top container that hosts a list of arbitrary `NSViewController`s,
/// one per tab. Generic and decoupled from any concrete content type — the
/// host owns the content view controllers and reacts to user actions
/// through `TabbedViewControllerDelegate`.
///
/// Layout: a `TabBarView` along the top + a content container below pinned
/// to the active tab's `view`. Switching tabs swaps which child view
/// controller's view is mounted in the container.
@MainActor
open class TabbedViewController: NSViewController {

    public struct Tab {
        public let id: UUID
        public var title: String
        public var viewController: NSViewController

        public init(id: UUID = UUID(), title: String, viewController: NSViewController) {
            self.id = id
            self.title = title
            self.viewController = viewController
        }
    }

    public weak var delegate: TabbedViewControllerDelegate?

    public private(set) var tabs: [Tab] = []

    public var selectedTabID: UUID? {
        get { _selectedTabID }
        set { selectTab(id: newValue) }
    }

    public var selectedTab: Tab? {
        guard let id = _selectedTabID else { return nil }
        return tabs.first(where: { $0.id == id })
    }

    private var _selectedTabID: UUID?

    private let tabBar = TabBarView()
    private let contentContainer = NSView()
    private var contentTopConstraint: NSLayoutConstraint?

    // MARK: - Lifecycle

    public init() {
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    public required init?(coder: NSCoder) { fatalError() }

    open override func loadView() {
        let root = NSView()
        root.translatesAutoresizingMaskIntoConstraints = false

        contentContainer.translatesAutoresizingMaskIntoConstraints = false

        root.addSubview(tabBar)
        root.addSubview(contentContainer)

        NSLayoutConstraint.activate([
            tabBar.topAnchor.constraint(equalTo: root.topAnchor),
            tabBar.leadingAnchor.constraint(equalTo: root.leadingAnchor),
            tabBar.trailingAnchor.constraint(equalTo: root.trailingAnchor),

            contentContainer.topAnchor.constraint(equalTo: tabBar.bottomAnchor),
            contentContainer.leadingAnchor.constraint(equalTo: root.leadingAnchor),
            contentContainer.trailingAnchor.constraint(equalTo: root.trailingAnchor),
            contentContainer.bottomAnchor.constraint(equalTo: root.bottomAnchor)
        ])

        self.view = root
    }

    open override func viewDidLoad() {
        super.viewDidLoad()

        tabBar.onSelect = { [weak self] id in
            guard let self else { return }
            self.selectTab(id: id)
            self.delegate?.tabbedViewController(self, didSelectTab: id)
        }
        tabBar.onClose = { [weak self] id in
            guard let self else { return }
            self.delegate?.tabbedViewController(self, didRequestCloseTab: id)
        }
        tabBar.onReorder = { [weak self] id, index in
            guard let self else { return }
            self.delegate?.tabbedViewController(self, didReorderTab: id, to: index)
        }
        syncTabBar()
    }

    // MARK: - Mutating API

    public func addTab(_ tab: Tab) {
        insertTab(tab, at: tabs.count)
    }

    public func insertTab(_ tab: Tab, at index: Int) {
        let clamped = max(0, min(index, tabs.count))
        tabs.insert(tab, at: clamped)
        syncTabBar()
        if _selectedTabID == nil {
            selectTab(id: tab.id)
        }
    }

    public func removeTab(id: UUID) {
        guard let index = tabs.firstIndex(where: { $0.id == id }) else { return }
        let wasSelected = (_selectedTabID == id)
        let removed = tabs.remove(at: index)
        if wasSelected {
            unmount(removed.viewController)
            // Pick a neighbor: prefer the tab that took its place, else the previous.
            let nextIndex = min(index, tabs.count - 1)
            if nextIndex >= 0 {
                _selectedTabID = tabs[nextIndex].id
                mount(tabs[nextIndex].viewController)
            } else {
                _selectedTabID = nil
            }
        }
        syncTabBar()
        if let id = _selectedTabID {
            delegate?.tabbedViewController(self, didSelectTab: id)
        }
    }

    public func renameTab(id: UUID, title: String) {
        guard let index = tabs.firstIndex(where: { $0.id == id }) else { return }
        tabs[index].title = title
        tabBar.renameItem(id: id, title: title)
    }

    public func moveTab(id: UUID, to index: Int) {
        guard let from = tabs.firstIndex(where: { $0.id == id }) else { return }
        let clamped = max(0, min(index, tabs.count - 1))
        guard from != clamped else { return }
        let item = tabs.remove(at: from)
        tabs.insert(item, at: clamped)
        syncTabBar()
        delegate?.tabbedViewController(self, didReorderTab: id, to: clamped)
    }

    /// File > New Tab — auto-disabled by AppKit when no responder
    /// implements this selector.
    @objc public func newTab(_ sender: Any?) {
        delegate?.tabbedViewControllerNeedsNewTab(self)
    }

    // MARK: - Selection

    private func selectTab(id: UUID?) {
        guard _selectedTabID != id else { return }
        if let oldID = _selectedTabID, let oldTab = tabs.first(where: { $0.id == oldID }) {
            unmount(oldTab.viewController)
        }
        _selectedTabID = id
        if let id, let newTab = tabs.first(where: { $0.id == id }) {
            mount(newTab.viewController)
        }
        tabBar.setSelected(id)
    }

    private func mount(_ viewController: NSViewController) {
        addChild(viewController)
        viewController.view.translatesAutoresizingMaskIntoConstraints = false
        contentContainer.addSubview(viewController.view)
        NSLayoutConstraint.activate([
            viewController.view.topAnchor.constraint(equalTo: contentContainer.topAnchor),
            viewController.view.leadingAnchor.constraint(equalTo: contentContainer.leadingAnchor),
            viewController.view.trailingAnchor.constraint(equalTo: contentContainer.trailingAnchor),
            viewController.view.bottomAnchor.constraint(equalTo: contentContainer.bottomAnchor)
        ])
    }

    private func unmount(_ viewController: NSViewController) {
        viewController.view.removeFromSuperview()
        viewController.removeFromParent()
    }

    // MARK: - Sync

    private func syncTabBar() {
        let items = tabs.map { TabBarView.ItemModel(id: $0.id, title: $0.title) }
        tabBar.setItems(items, selectedID: _selectedTabID)
    }
}
