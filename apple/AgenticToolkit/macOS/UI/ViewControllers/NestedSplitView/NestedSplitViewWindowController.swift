import AppKit
import AgenticToolkitCore
import AgenticToolkitCoreUI
import AgenticToolkitCoreMacOS


/// Document window for `.whiproj` packages. All document windows share a
/// single `WindowManager` spec so frame geometry persists in the app
/// preferences (not per-document) — content layout (the per-tab nested
/// split tree, tab arrangement, active tab) lives in the package's SQLite.
///
/// The window's content view is a generic `TabbedViewController` from the
/// toolkit. Each tab hosts its own `NestingSplitViewController` rooted at
/// the layout tree persisted for that tab.
@MainActor
public final class NestedSplitViewWindowController: WindowController<NSViewController> {

    public static let sharedWindowID = "whiprojDocumentWindow"

    private let splitDocument: NestedSplitViewDocument
    private let tabbed: TabbedViewController

    /// Live mapping from a tab's UUID to the tab's root `NestingSplitViewController`.
    /// Used by the layout-change callback to rebuild a tab's `TabRecord`
    /// when the user splits / closes panes inside a tab.
    private var splitControllersByTabID: [UUID: NestingSplitViewController] = [:]

    public init(document: NestedSplitViewDocument) {
        self.splitDocument = document
        self.tabbed = TabbedViewController()
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

    public override func showWindow(_ sender: Any?) {
        // `NSWindowController.init(window: nil)` (which SingleWindowController
        // chains into) leaves `isWindowLoaded = true`, so the default
        // `showWindow(_:)` never calls `loadWindow()`. Force it here so
        // `NSDocument.showWindows()` actually produces a visible window.
        if window == nil { loadWindow() }
        super.showWindow(sender)
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
            tabbed.addTab(.init(id: record.id, title: record.title, viewController: split))
        }
        tabbed.selectedTabID = initial.activeTabID
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
        for tab in tabbed.tabs {
            guard let split = splitControllersByTabID[tab.id] else { continue }
            records.append(TabRecord(
                id: tab.id,
                title: tab.title,
                root: split.snapshotNode(),
                focusedNodeID: nil // Phase 5 fills this in
            ))
        }
        splitDocument.persistTabs(records, activeTabID: tabbed.selectedTabID)
    }

    private static func defaultTabLayout() -> LayoutNode {
        LayoutNode.split(
            orientation: "horizontal",
            first: LayoutNode.leaf(contentType: NestedContentRegistry.placeholderIdentifier),
            second: LayoutNode.leaf(contentType: NestedContentRegistry.placeholderIdentifier)
        )
    }
}

// MARK: - TabbedViewControllerDelegate

extension NestedSplitViewWindowController: TabbedViewControllerDelegate {

    public func tabbedViewControllerNeedsNewTab(_ controller: TabbedViewController) {
        let id = UUID()
        let split = NestingSplitViewController.make(
            from: Self.defaultTabLayout(),
            document: splitDocument,
            isRoot: true
        )
        wireLayoutCallback(on: split, tabID: id)
        splitControllersByTabID[id] = split
        let title = "Tab \(controller.tabs.count + 1)"
        controller.addTab(.init(id: id, title: title, viewController: split))
        controller.selectedTabID = id
        persistAllTabs()
    }

    public func tabbedViewController(_ controller: TabbedViewController, didSelectTab id: UUID) {
        persistAllTabs()
    }

    public func tabbedViewController(_ controller: TabbedViewController, didRequestCloseTab id: UUID) {
        // Refuse to close the last tab in a window — mirrors Safari/Terminal.
        guard controller.tabs.count > 1 else { return }
        controller.removeTab(id: id)
        splitControllersByTabID.removeValue(forKey: id)
        persistAllTabs()
    }

    public func tabbedViewController(_ controller: TabbedViewController, didReorderTab id: UUID, to index: Int) {
        persistAllTabs()
    }
}
