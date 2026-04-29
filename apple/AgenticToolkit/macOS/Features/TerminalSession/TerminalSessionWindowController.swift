import AppKit
import os
import AgenticToolkitCore
import AgenticToolkitCoreUI
import AgenticToolkitCoreMacOS

/// Lifecycle callbacks for a `TerminalSessionWindowController`. Apps own the
/// lifecycle of terminal windows; the controller notifies the delegate
/// when its window is closing so the app can remove its reference.
@MainActor
public protocol TerminalSessionWindowLifecycleDelegate: AnyObject {
    func terminalWindowWillClose(_ controller: TerminalSessionWindowController)
}

/// Manages a single terminal window with its own session list.
@MainActor
public final class TerminalSessionWindowController: WindowController<TerminalSessionSplitViewController> {

    public let sessionManager: TerminalSessionManager
    public weak var lifecycleDelegate: TerminalSessionWindowLifecycleDelegate?

    public static let windowID = "terminal"

    public init() {
        let manager = TerminalSessionManager()
        self.sessionManager = manager
        super.init(
            windowID: Self.windowID,
            contentViewController: TerminalSessionSplitViewController(sessionManager: manager)
        )
        self.windowSpec = WindowSpec(
            defaultSize: NSSize(width: 800, height: 600),
            minSize: NSSize(width: 600, height: 400),
            defaultPosition: .center,
            persistsFrame: true
        )
        self.windowTitle = "Terminal"
        self.windowStyleMask = [.titled, .closable, .miniaturizable, .resizable]
    }

    public override func showWindow(_ sender: Any?) {
        super.showWindow(sender)
        if sessionManager.sessions.isEmpty {
            sessionManager.addSession()
        }
    }

    public override func windowWillClose(_ notification: Notification) {
        sessionManager.terminateAll()
        logger.info("Terminal window closed, sessions terminated")
        lifecycleDelegate?.terminalWindowWillClose(self)
    }

    public func toggleSidebar() {
        viewController?.toggleSidebar()
    }
}

extension TerminalSessionWindowController: Loggable {
    public static nonisolated let logger = makeLogger()
}
