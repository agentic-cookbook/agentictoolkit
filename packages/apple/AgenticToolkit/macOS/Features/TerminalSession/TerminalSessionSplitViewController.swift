import AppKit
import AgenticToolkitCore
import AgenticToolkitCoreMacOS

/// Split view controller with a sidebar (session list) and content area (terminal).
@MainActor
public final class TerminalSessionSplitViewController: ThemedSplitViewController {

    public let sessionManager: TerminalSessionManager
    public let sessionListVC: TerminalSessionListViewController
    public let terminalContentVC: TerminalSessionContentViewController

    /// Divider-position autosave key. AppKit keys these globally, so two split
    /// views alive at once under one name fight over the same stored position —
    /// which is exactly what happens once a document holds several terminal
    /// panes. Callers that can have more than one pass a distinct name.
    private let splitAutosaveName: String

    public init(sessionManager: TerminalSessionManager, autosaveName: String = "terminal-split") {
        self.sessionManager = sessionManager
        self.splitAutosaveName = autosaveName
        self.sessionListVC = TerminalSessionListViewController(sessionManager: sessionManager)
        self.terminalContentVC = TerminalSessionContentViewController(sessionManager: sessionManager)
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    public required init?(coder: NSCoder) { fatalError() }

    public override func viewDidLoad() {
        super.viewDidLoad()

        let sidebarItem = NSSplitViewItem(sidebarWithViewController: sessionListVC)
        sidebarItem.minimumThickness = 150
        sidebarItem.maximumThickness = 300
        sidebarItem.canCollapse = true
        sidebarItem.holdingPriority = .defaultLow + 1

        let contentItem = NSSplitViewItem(viewController: terminalContentVC)
        contentItem.minimumThickness = 400

        addSplitViewItem(sidebarItem)
        addSplitViewItem(contentItem)

        splitView.dividerStyle = .thin
        splitView.autosaveName = NSSplitView.AutosaveName(splitAutosaveName)
    }

    public func toggleSidebar() {
        if let sidebarItem = splitViewItems.first {
            sidebarItem.animator().isCollapsed = !sidebarItem.isCollapsed
        }
    }
}

extension TerminalSessionSplitViewController: PaneContentTeardown {
    /// A closed pane's shells go with it — they are child processes of the app,
    /// so nothing else would ever reap them.
    public func paneContentWillBeDiscarded() {
        sessionManager.terminateAll()
    }
}
