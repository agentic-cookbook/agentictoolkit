import AppKit
import AgenticToolkitCore
import AgenticToolkitCoreUI
import AgenticToolkitCoreMacOS

/// Document window for `.whiproj` packages. All document windows share a
/// single `WindowManager` spec so frame geometry persists in the app
/// preferences (not per-document) — content layout (the per-tab nested
/// split tree, tab arrangement, active tab) lives in the package's SQLite.
///
/// The window's content view is a generic `MultiTabbedViewController` from the
/// toolkit. Each tab hosts its own `NestingSplitViewController` rooted at
/// the layout tree persisted for that tab.
///
/// The tab count is global across edges: one document-level "tab" is a
/// group with one member tab per enabled edge, all sharing a title.
/// Creating a tab creates a member on every enabled edge, closing any
/// member closes its whole group, and a newly enabled edge is topped up
/// to one member per group.
@MainActor
public final class NestedSplitViewWindowController: WindowController<NSViewController> {

    public static let sharedWindowID = "whiprojDocumentWindow"

    private struct TabGroup {
        var title: String
        var members: [Edge: UUID]
    }

    private let splitDocument: NestedSplitViewDocument
    private let tabbed: MultiTabbedViewController

    /// Document-level tabs, in creation order. Only top-edge members are
    /// persisted (the layout store predates the other edges).
    private var tabGroups: [TabGroup] = []

    /// Live mapping from a tab's UUID to the tab's root `NestingSplitViewController`.
    /// Used by the layout-change callback to rebuild a tab's `TabRecord`
    /// when the user splits / closes panes inside a tab.
    private var splitControllersByTabID: [UUID: NestingSplitViewController] = [:]

    /// Last focused leaf nodeID per tab — written through every time the
    /// window's first responder changes inside the active tab. Persisted
    /// alongside the layout tree on the next save.
    private var focusedLeafByTabID: [UUID: UUID] = [:]

    private var firstResponderObserver: NSObjectProtocol?
    private var pendingFocusPersist: DispatchWorkItem?
    private static let focusPersistDelay: DispatchTimeInterval = .milliseconds(250)

    private var edgesAccessory: NSTitlebarAccessoryViewController?

    public init(document: NestedSplitViewDocument) {
        self.splitDocument = document
        self.tabbed = MultiTabbedViewController()
        super.init(windowID: Self.sharedWindowID, contentViewController: tabbed)

        self.windowSpec = WindowSpec(
            defaultSize: NSSize(width: 800, height: 500),
            minSize: NSSize(width: 400, height: 300),
            defaultPosition: .center,
            persistsFrame: true
        )
        self.windowTitle = document.displayName ?? "Untitled"
        self.windowStyleMask = [.titled, .closable, .resizable, .miniaturizable]
        self.minSize = NSSize(width: 400, height: 300)

        tabbed.delegate = self
        installInitialTabs()
    }

    isolated deinit {
        if let firstResponderObserver {
            NotificationCenter.default.removeObserver(firstResponderObserver)
        }
    }

    public override func showWindow(_ sender: Any?) {
        // `NSWindowController.init(window: nil)` (which SingleWindowController
        // chains into) leaves `isWindowLoaded = true`, so the default
        // `showWindow(_:)` never calls `loadWindow()`. Force it here so
        // `NSDocument.showWindows()` actually produces a visible window.
        if window == nil { loadWindow() }
        super.showWindow(sender)
        installFirstResponderObserverIfNeeded()
        installEdgesAccessoryIfNeeded()
        restoreFocusedLeafForActiveTab()
    }

    // MARK: - Tab-edge toggle (titlebar accessory)

    private func installEdgesAccessoryIfNeeded() {
        guard edgesAccessory == nil, let window else { return }

        let symbol = NSImage(
            systemSymbolName: "rectangle.3.group",
            accessibilityDescription: "Tab Edges"
        )?.withSymbolConfiguration(.init(pointSize: 14, weight: .regular))

        let button = NSButton(image: symbol ?? NSImage(), target: self, action: #selector(showEdgesMenu(_:)))
        button.bezelStyle = .texturedRounded
        button.imagePosition = .imageOnly
        button.toolTip = "Show / hide tab bars"
        button.frame = NSRect(x: 0, y: 0, width: 36, height: 24)
        button.accessibilityID("document-window.tab-edges-button")

        let accessory = NSTitlebarAccessoryViewController()
        accessory.view = button
        accessory.layoutAttribute = .right
        window.addTitlebarAccessoryViewController(accessory)
        edgesAccessory = accessory
    }

    @objc
    private func showEdgesMenu(_ sender: NSButton) {
        let menu = NSMenu()
        for edge in [Edge.top, .right, .bottom, .left] {
            let item = NSMenuItem(
                title: Self.title(for: edge),
                action: #selector(toggleEdgeAction(_:)),
                keyEquivalent: ""
            )
            item.target = self
            item.representedObject = edge
            item.state = tabbed.isEdgeEnabled(edge) ? .on : .off
            item.accessibilityID("document-window.tab-edges.\(AccessibilityID.slug(Self.title(for: edge)))")
            menu.addItem(item)
        }
        menu.popUp(
            positioning: nil,
            at: NSPoint(x: 0, y: sender.bounds.maxY + 4),
            in: sender
        )
    }

    @objc
    private func toggleEdgeAction(_ sender: NSMenuItem) {
        guard let edge = sender.representedObject as? Edge else { return }
        setEdgeEnabled(edge, !tabbed.isEdgeEnabled(edge))
    }

    /// Single entry point for edge toggling (titlebar menu and Cocoa
    /// Scripting alike) so a freshly enabled edge is always topped up to
    /// the global tab count. Disabling keeps the edge's members so
    /// re-enabling restores them.
    private func setEdgeEnabled(_ edge: Edge, _ enabled: Bool) {
        guard tabbed.isEdgeEnabled(edge) != enabled else { return }
        tabbed.setEdgeEnabled(edge, enabled)
        if enabled {
            topUpTabs(on: edge)
        }
    }

    /// Gives `edge` one member tab per group so its count matches the
    /// global tab count.
    private func topUpTabs(on edge: Edge) {
        var added = false
        for (index, group) in tabGroups.enumerated() where group.members[edge] == nil {
            let id = UUID()
            let split = makeSplitController(for: id)
            tabbed.insertTab(.init(id: id, title: group.title, viewController: split), at: index, on: edge)
            tabGroups[index].members[edge] = id
            added = true
        }
        if added {
            persistAllTabs()
        }
    }

    /// Creates a document-level tab: one member per enabled edge, all
    /// sharing a title, and activates the first member.
    private func addTabGroup() {
        let title = "Tab \(tabGroups.count + 1)"
        var group = TabGroup(title: title, members: [:])
        for edge in Edge.allCases where tabbed.isEdgeEnabled(edge) {
            let id = UUID()
            let split = makeSplitController(for: id)
            tabbed.addTab(.init(id: id, title: title, viewController: split), on: edge)
            group.members[edge] = id
        }
        tabGroups.append(group)
        for edge in Edge.allCases {
            if let id = group.members[edge] {
                tabbed.selectTab(id: id, on: edge)
                break
            }
        }
        persistAllTabs()
    }

    private func makeSplitController(for tabID: UUID) -> NestingSplitViewController {
        let split = NestingSplitViewController.make(
            from: Self.defaultTabLayout(),
            document: splitDocument,
            isRoot: true
        )
        wireLayoutCallback(on: split, tabID: tabID)
        splitControllersByTabID[tabID] = split
        return split
    }

    private static func title(for edge: Edge) -> String {
        switch edge {
        case .top: return "Top"
        case .right: return "Right"
        case .bottom: return "Bottom"
        case .left: return "Left"
        }
    }

    // MARK: - Tab-edge accessors (used by Cocoa Scripting bridges)

    /// Names of the tab edges currently enabled in this window. Names are
    /// lowercase: `"top"`, `"right"`, `"bottom"`, `"left"`. Order matches
    /// `Edge.allCases`.
    public var enabledTabEdgeNames: [String] {
        get { Edge.allCases.filter { tabbed.isEdgeEnabled($0) }.map(Self.scriptingName(for:)) }
        set {
            let normalized = Set(newValue.map { $0.lowercased() })
            for edge in Edge.allCases {
                setEdgeEnabled(edge, normalized.contains(Self.scriptingName(for: edge)))
            }
        }
    }

    private static func scriptingName(for edge: Edge) -> String {
        switch edge {
        case .top: return "top"
        case .right: return "right"
        case .bottom: return "bottom"
        case .left: return "left"
        }
    }

    // MARK: - Focused-leaf tracking

    private func installFirstResponderObserverIfNeeded() {
        guard firstResponderObserver == nil, let window else { return }
        // `NSWindow.didUpdateNotification` fires on every event-loop turn
        // where the window state changed — including first-responder
        // changes. Cheap to observe, debounced before we hit SQLite.
        firstResponderObserver = NotificationCenter.default.addObserver(
            forName: NSWindow.didUpdateNotification,
            object: window,
            queue: .main
        ) { [weak self] _ in
            MainActor.assumeIsolated {
                self?.refreshFocusedLeaf()
            }
        }
    }

    private func refreshFocusedLeaf() {
        guard let activeTabID = tabbed.selectedTabID(on: .top),
              let activeSplit = splitControllersByTabID[activeTabID] else { return }
        let newLeaf = activeSplit.focusedLeafNodeID
        let prior = focusedLeafByTabID[activeTabID]
        guard newLeaf != prior else { return }
        if let newLeaf {
            focusedLeafByTabID[activeTabID] = newLeaf
        } else {
            focusedLeafByTabID.removeValue(forKey: activeTabID)
        }
        scheduleFocusPersist()
    }

    private func scheduleFocusPersist() {
        pendingFocusPersist?.cancel()
        let work = DispatchWorkItem { [weak self] in
            self?.persistAllTabs()
        }
        pendingFocusPersist = work
        DispatchQueue.main.asyncAfter(deadline: .now() + Self.focusPersistDelay, execute: work)
    }

    private func restoreFocusedLeafForActiveTab() {
        guard let activeTabID = tabbed.selectedTabID(on: .top),
              let activeSplit = splitControllersByTabID[activeTabID],
              let focusedNodeID = focusedLeafByTabID[activeTabID] else { return }
        // Defer one runloop tick so the tab's view hierarchy is fully
        // mounted before we try to make a leaf first responder.
        DispatchQueue.main.async {
            activeSplit.makeLeafFirstResponder(nodeID: focusedNodeID)
        }
    }

    // MARK: - Tab installation

    private func installInitialTabs() {
        let initial = splitDocument.initialTabs()
        for record in initial.tabs {
            let split = NestingSplitViewController.make(
                from: record.root,
                document: splitDocument,
                isRoot: true
            )
            wireLayoutCallback(on: split, tabID: record.id)
            splitControllersByTabID[record.id] = split
            if let focusedNodeID = record.focusedNodeID {
                focusedLeafByTabID[record.id] = focusedNodeID
            }
            tabbed.addTab(.init(id: record.id, title: record.title, viewController: split), on: .top)
            tabGroups.append(TabGroup(title: record.title, members: [.top: record.id]))
        }
        tabbed.selectTab(id: initial.activeTabID, on: .top)
    }

    private func wireLayoutCallback(on split: NestingSplitViewController, tabID: UUID) {
        split.onLayoutDidChange = { [weak self] _ in
            self?.persistAllTabs()
        }
    }

    /// Snapshots every tab's split tree and writes the full set back to
    /// the document. Called whenever the user touches the layout (split,
    /// close, tab add/remove/reorder/select).
    private func persistAllTabs() {
        var records: [TabRecord] = []
        for tab in tabbed.tabs(on: .top) {
            guard let split = splitControllersByTabID[tab.id] else { continue }
            records.append(TabRecord(
                id: tab.id,
                title: tab.title,
                root: split.snapshotNode(),
                focusedNodeID: focusedLeafByTabID[tab.id]
            ))
        }
        splitDocument.persistTabs(records, activeTabID: tabbed.selectedTabID(on: .top))
    }

    private static func defaultTabLayout() -> LayoutNode {
        LayoutNode.split(
            orientation: "horizontal",
            first: LayoutNode.leaf(contentType: NestedContentRegistry.placeholderIdentifier),
            second: LayoutNode.leaf(contentType: NestedContentRegistry.placeholderIdentifier)
        )
    }
}

// MARK: - MultiTabbedViewControllerDelegate

extension NestedSplitViewWindowController: MultiTabbedViewControllerDelegate {

    public func multiTabbedViewControllerNeedsNewTab(_ controller: MultiTabbedViewController) {
        addTabGroup()
    }

    public func multiTabbedViewController(
        _ controller: MultiTabbedViewController,
        didSelectTab id: UUID,
        on edge: Edge
    ) {
        restoreFocusedLeafForActiveTab()
        persistAllTabs()
    }

    public func multiTabbedViewController(
        _ controller: MultiTabbedViewController,
        didRequestCloseTab id: UUID,
        on edge: Edge
    ) {
        // Closing any member closes its whole group. Refuse to close the
        // last group (mirrors Safari/Terminal keeping one tab).
        guard let groupIndex = tabGroups.firstIndex(where: { $0.members.values.contains(id) }) else { return }
        guard tabGroups.count > 1 else { return }
        let group = tabGroups.remove(at: groupIndex)
        // Remove the clicked member first: if it is active, the controller
        // activates its neighbor on the same edge before the rest of the
        // group disappears.
        let ordered = [id] + group.members.values.filter { $0 != id }
        for memberID in ordered {
            controller.removeTab(id: memberID)
            splitControllersByTabID.removeValue(forKey: memberID)
            focusedLeafByTabID.removeValue(forKey: memberID)
        }
        persistAllTabs()
    }

    public func multiTabbedViewController(
        _ controller: MultiTabbedViewController,
        didReorderTab id: UUID,
        to index: Int,
        on edge: Edge
    ) {
        persistAllTabs()
    }
}
