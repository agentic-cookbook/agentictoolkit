import AppKit

/// Split view controller with a sidebar (session list) and content area (terminal).
@MainActor
public final class TerminalSplitViewController: NSSplitViewController {

    public let sessionManager: TerminalSessionManager
    public let sessionListVC: TerminalSessionListViewController
    public let terminalContentVC: TerminalContentViewController

    public init(sessionManager: TerminalSessionManager) {
        self.sessionManager = sessionManager
        self.sessionListVC = TerminalSessionListViewController(sessionManager: sessionManager)
        self.terminalContentVC = TerminalContentViewController(sessionManager: sessionManager)
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

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
        splitView.autosaveName = "terminal-split"
    }

    public func toggleSidebar() {
        if let sidebarItem = splitViewItems.first {
            sidebarItem.animator().isCollapsed = !sidebarItem.isCollapsed
        }
    }
}
