import AppKit

/// IDE-style tabbed container with up to four edge-docked tab bars (top,
/// right, bottom, left) plus a host-supplied center main view. Each enabled
/// edge owns its own tab list, active tab, and content area; edges can be
/// toggled on/off independently.
///
/// Layout (when all four edges enabled):
/// ```
/// outer NSSplitView (vertical layout: panes stacked top→bottom)
/// ├── EdgePanel(.top)
/// ├── inner NSSplitView (horizontal layout: panes side by side)
/// │   ├── EdgePanel(.left)
/// │   ├── centerContainer ← mainContentViewController.view
/// │   └── EdgePanel(.right)
/// └── EdgePanel(.bottom)
/// ```
///
/// Hidden edges drop out of the split view; their `EdgePanel` (and the
/// child view controllers it hosts) is retained so re-enabling restores
/// state.
@MainActor
open class TabbedViewController: NSViewController {

    // MARK: - Public types

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

    // MARK: - Public properties

    public weak var delegate: TabbedViewControllerDelegate?

    /// Which edge `newTab(_:)` (File > New Tab) targets.
    public var newTabTargetEdge: Edge = .top

    public var mainContentViewController: NSViewController? {
        didSet {
            guard oldValue !== mainContentViewController else { return }
            swapMainContent(old: oldValue, new: mainContentViewController)
        }
    }

    // MARK: - Private state

    @MainActor
    private final class EdgeState {
        var enabled: Bool
        var size: CGFloat
        var tabs: [Tab] = []
        var selectedTabID: UUID?

        init(enabled: Bool, size: CGFloat) {
            self.enabled = enabled
            self.size = size
        }
    }

    private var edgeStates: [Edge: EdgeState] = [
        .top: EdgeState(enabled: true, size: 200),
        .right: EdgeState(enabled: false, size: 280),
        .bottom: EdgeState(enabled: false, size: 200),
        .left: EdgeState(enabled: false, size: 280)
    ]

    private var edgePanels: [Edge: EdgePanel] = [:]

    private let outerSplit = NSSplitView()
    private let innerSplit = NSSplitView()
    private let centerContainer = NSView()

    private var splitArrangementDirty = false

    // MARK: - Lifecycle

    public init() {
        super.init(nibName: nil, bundle: nil)
        for edge in Edge.allCases {
            let panel = EdgePanel(edge: edge)
            panel.frame = NSRect(origin: .zero, size: defaultPanelFrameSize(for: edge))
            edgePanels[edge] = panel
            wireCallbacks(for: panel)
        }
    }

    @available(*, unavailable)
    public required init?(coder: NSCoder) { fatalError() }

    open override func loadView() {
        let root = NSView()

        outerSplit.isVertical = false
        outerSplit.dividerStyle = .thin
        outerSplit.translatesAutoresizingMaskIntoConstraints = false

        innerSplit.isVertical = true
        innerSplit.dividerStyle = .thin
        innerSplit.translatesAutoresizingMaskIntoConstraints = false
        innerSplit.frame = NSRect(x: 0, y: 0, width: 600, height: 400)

        centerContainer.translatesAutoresizingMaskIntoConstraints = false

        rebuildSplitArrangement()

        root.addSubview(outerSplit)
        NSLayoutConstraint.activate([
            outerSplit.topAnchor.constraint(equalTo: root.topAnchor),
            outerSplit.leadingAnchor.constraint(equalTo: root.leadingAnchor),
            outerSplit.trailingAnchor.constraint(equalTo: root.trailingAnchor),
            outerSplit.bottomAnchor.constraint(equalTo: root.bottomAnchor)
        ])

        self.view = root
    }

    open override func viewDidLoad() {
        super.viewDidLoad()
        if let main = mainContentViewController {
            mountMain(main)
        }
        for edge in Edge.allCases {
            syncTabBar(for: edge)
            mountSelectedTabContent(on: edge)
        }
    }

    open override func viewDidLayout() {
        super.viewDidLayout()
        if splitArrangementDirty {
            applyDividerPositions()
            splitArrangementDirty = false
        }
    }

    // MARK: - Edge enable/disable

    public func setEdgeEnabled(_ edge: Edge, _ enabled: Bool) {
        guard let state = edgeStates[edge], state.enabled != enabled else { return }
        state.enabled = enabled
        guard isViewLoaded else { return }
        rebuildSplitArrangement()
        if enabled {
            mountSelectedTabContent(on: edge)
        }
    }

    public func isEdgeEnabled(_ edge: Edge) -> Bool {
        edgeStates[edge]?.enabled ?? false
    }

    public func setEdgeSize(_ edge: Edge, _ size: CGFloat) {
        guard let state = edgeStates[edge] else { return }
        state.size = size
        guard let panel = edgePanels[edge] else { return }
        switch edge {
        case .top, .bottom:
            panel.frame.size.height = size
        case .left, .right:
            panel.frame.size.width = size
        }
        if isViewLoaded {
            splitArrangementDirty = true
            view.needsLayout = true
        }
    }

    // MARK: - Tab manipulation (per edge)

    public func addTab(_ tab: Tab, on edge: Edge) {
        insertTab(tab, at: tabs(on: edge).count, on: edge)
    }

    public func insertTab(_ tab: Tab, at index: Int, on edge: Edge) {
        guard let state = edgeStates[edge] else { return }
        let clamped = max(0, min(index, state.tabs.count))
        state.tabs.insert(tab, at: clamped)
        syncTabBar(for: edge)
        if state.selectedTabID == nil {
            selectTab(id: tab.id, on: edge)
        }
    }

    public func removeTab(id: UUID) {
        guard let edge = edge(forTabID: id), let state = edgeStates[edge] else { return }
        guard let index = state.tabs.firstIndex(where: { $0.id == id }) else { return }
        let wasSelected = (state.selectedTabID == id)
        let removed = state.tabs.remove(at: index)
        if wasSelected {
            if isViewLoaded {
                unmountTabContent(removed.viewController)
            }
            let nextIndex = min(index, state.tabs.count - 1)
            if nextIndex >= 0 {
                state.selectedTabID = state.tabs[nextIndex].id
                if isViewLoaded, let panel = edgePanels[edge] {
                    mountTabContent(state.tabs[nextIndex].viewController, in: panel)
                }
            } else {
                state.selectedTabID = nil
            }
        }
        syncTabBar(for: edge)
        if let id = state.selectedTabID {
            delegate?.tabbedViewController(self, didSelectTab: id, on: edge)
        }
    }

    public func renameTab(id: UUID, title: String) {
        guard let edge = edge(forTabID: id), let state = edgeStates[edge] else { return }
        guard let idx = state.tabs.firstIndex(where: { $0.id == id }) else { return }
        state.tabs[idx].title = title
        edgePanels[edge]?.tabBar.renameItem(id: id, title: title)
    }

    public func moveTab(id: UUID, to index: Int, on edge: Edge) {
        guard let state = edgeStates[edge] else { return }
        guard let from = state.tabs.firstIndex(where: { $0.id == id }) else { return }
        let clamped = max(0, min(index, state.tabs.count - 1))
        guard from != clamped else { return }
        let item = state.tabs.remove(at: from)
        state.tabs.insert(item, at: clamped)
        syncTabBar(for: edge)
        delegate?.tabbedViewController(self, didReorderTab: id, to: clamped, on: edge)
    }

    // MARK: - Inspection

    public func tabs(on edge: Edge) -> [Tab] {
        edgeStates[edge]?.tabs ?? []
    }

    public func selectedTab(on edge: Edge) -> Tab? {
        guard let state = edgeStates[edge], let id = state.selectedTabID else { return nil }
        return state.tabs.first(where: { $0.id == id })
    }

    public func selectedTabID(on edge: Edge) -> UUID? {
        edgeStates[edge]?.selectedTabID
    }

    public func selectTab(id: UUID, on edge: Edge) {
        guard let state = edgeStates[edge], state.selectedTabID != id else { return }
        let oldID = state.selectedTabID
        state.selectedTabID = id
        if isViewLoaded {
            if let oldID, let oldTab = state.tabs.first(where: { $0.id == oldID }) {
                unmountTabContent(oldTab.viewController)
            }
            if let newTab = state.tabs.first(where: { $0.id == id }), let panel = edgePanels[edge] {
                mountTabContent(newTab.viewController, in: panel)
            }
        }
        edgePanels[edge]?.tabBar.setSelected(id)
    }

    // MARK: - File menu hook

    /// File > New Tab — auto-disabled by AppKit when no responder
    /// implements this selector.
    @objc public func newTab(_ sender: Any?) {
        delegate?.tabbedViewControllerNeedsNewTab(self, on: newTabTargetEdge)
    }

    // MARK: - Wiring

    private func wireCallbacks(for panel: EdgePanel) {
        let edge = panel.edge
        panel.tabBar.onSelect = { [weak self] id in
            guard let self else { return }
            self.selectTab(id: id, on: edge)
            self.delegate?.tabbedViewController(self, didSelectTab: id, on: edge)
        }
        panel.tabBar.onClose = { [weak self] id in
            guard let self else { return }
            self.delegate?.tabbedViewController(self, didRequestCloseTab: id, on: edge)
        }
        panel.tabBar.onReorder = { [weak self] id, index in
            guard let self else { return }
            self.delegate?.tabbedViewController(self, didReorderTab: id, to: index, on: edge)
        }
    }

    // MARK: - Layout

    private func rebuildSplitArrangement() {
        for sub in outerSplit.arrangedSubviews {
            outerSplit.removeArrangedSubview(sub)
            sub.removeFromSuperview()
        }
        for sub in innerSplit.arrangedSubviews {
            innerSplit.removeArrangedSubview(sub)
            sub.removeFromSuperview()
        }

        if isEdgeEnabled(.left), let panel = edgePanels[.left] {
            innerSplit.addArrangedSubview(panel)
        }
        innerSplit.addArrangedSubview(centerContainer)
        if isEdgeEnabled(.right), let panel = edgePanels[.right] {
            innerSplit.addArrangedSubview(panel)
        }

        if isEdgeEnabled(.top), let panel = edgePanels[.top] {
            outerSplit.addArrangedSubview(panel)
        }
        outerSplit.addArrangedSubview(innerSplit)
        if isEdgeEnabled(.bottom), let panel = edgePanels[.bottom] {
            outerSplit.addArrangedSubview(panel)
        }

        applyHoldingPriorities()
        splitArrangementDirty = true
        if isViewLoaded { view.needsLayout = true }
    }

    private func applyHoldingPriorities() {
        // Center is elastic; edge panels resist resizing so the center
        // absorbs window-size changes.
        let panelPriority = NSLayoutConstraint.Priority(260)
        let centerPriority = NSLayoutConstraint.Priority(240)

        for (idx, sub) in innerSplit.arrangedSubviews.enumerated() {
            let priority: NSLayoutConstraint.Priority = (sub === centerContainer) ? centerPriority : panelPriority
            innerSplit.setHoldingPriority(priority, forSubviewAt: idx)
        }
        for (idx, sub) in outerSplit.arrangedSubviews.enumerated() {
            let priority: NSLayoutConstraint.Priority = (sub === innerSplit) ? centerPriority : panelPriority
            outerSplit.setHoldingPriority(priority, forSubviewAt: idx)
        }
    }

    private func applyDividerPositions() {
        var outerIdx = 0
        if isEdgeEnabled(.top), let topSize = edgeStates[.top]?.size, outerSplit.subviews.count > outerIdx + 1 {
            outerSplit.setPosition(topSize, ofDividerAt: outerIdx)
            outerIdx += 1
        }
        if isEdgeEnabled(.bottom),
           let bottomSize = edgeStates[.bottom]?.size,
           outerSplit.subviews.count > outerIdx + 1 {
            let pos = outerSplit.bounds.height - bottomSize
            outerSplit.setPosition(pos, ofDividerAt: outerIdx)
        }

        var innerIdx = 0
        if isEdgeEnabled(.left), let leftSize = edgeStates[.left]?.size, innerSplit.subviews.count > innerIdx + 1 {
            innerSplit.setPosition(leftSize, ofDividerAt: innerIdx)
            innerIdx += 1
        }
        if isEdgeEnabled(.right), let rightSize = edgeStates[.right]?.size, innerSplit.subviews.count > innerIdx + 1 {
            let pos = innerSplit.bounds.width - rightSize
            innerSplit.setPosition(pos, ofDividerAt: innerIdx)
        }
    }

    private func defaultPanelFrameSize(for edge: Edge) -> NSSize {
        let size = edgeStates[edge]?.size ?? 200
        switch edge {
        case .top, .bottom:
            return NSSize(width: 600, height: size)
        case .left, .right:
            return NSSize(width: size, height: 400)
        }
    }

    // MARK: - Mounting

    private func swapMainContent(old: NSViewController?, new: NSViewController?) {
        if let old, isViewLoaded {
            old.view.removeFromSuperview()
            old.removeFromParent()
        }
        if let new, isViewLoaded {
            mountMain(new)
        }
    }

    private func mountMain(_ controller: NSViewController) {
        addChild(controller)
        controller.view.translatesAutoresizingMaskIntoConstraints = false
        centerContainer.addSubview(controller.view)
        NSLayoutConstraint.activate([
            controller.view.topAnchor.constraint(equalTo: centerContainer.topAnchor),
            controller.view.leadingAnchor.constraint(equalTo: centerContainer.leadingAnchor),
            controller.view.trailingAnchor.constraint(equalTo: centerContainer.trailingAnchor),
            controller.view.bottomAnchor.constraint(equalTo: centerContainer.bottomAnchor)
        ])
    }

    private func mountSelectedTabContent(on edge: Edge) {
        guard isViewLoaded,
              let state = edgeStates[edge],
              let id = state.selectedTabID,
              let tab = state.tabs.first(where: { $0.id == id }),
              let panel = edgePanels[edge] else { return }
        mountTabContent(tab.viewController, in: panel)
    }

    private func mountTabContent(_ controller: NSViewController, in panel: EdgePanel) {
        if controller.parent !== self {
            addChild(controller)
        }
        if controller.view.superview !== panel.contentContainer {
            controller.view.translatesAutoresizingMaskIntoConstraints = false
            panel.contentContainer.addSubview(controller.view)
            NSLayoutConstraint.activate([
                controller.view.topAnchor.constraint(equalTo: panel.contentContainer.topAnchor),
                controller.view.leadingAnchor.constraint(equalTo: panel.contentContainer.leadingAnchor),
                controller.view.trailingAnchor.constraint(equalTo: panel.contentContainer.trailingAnchor),
                controller.view.bottomAnchor.constraint(equalTo: panel.contentContainer.bottomAnchor)
            ])
        }
    }

    private func unmountTabContent(_ controller: NSViewController) {
        controller.view.removeFromSuperview()
        controller.removeFromParent()
    }

    // MARK: - Sync

    private func syncTabBar(for edge: Edge) {
        guard let state = edgeStates[edge], let panel = edgePanels[edge] else { return }
        let items = state.tabs.map { TabBarView.ItemModel(id: $0.id, title: $0.title) }
        panel.tabBar.setItems(items, selectedID: state.selectedTabID)
    }

    private func edge(forTabID id: UUID) -> Edge? {
        for edge in Edge.allCases where edgeStates[edge]?.tabs.contains(where: { $0.id == id }) == true {
            return edge
        }
        return nil
    }
}
