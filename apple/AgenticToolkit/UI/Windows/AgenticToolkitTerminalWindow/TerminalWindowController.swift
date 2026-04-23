import AppKit
import AgenticToolkitCore
import AgenticToolkitCoreUI
import os

/// Lifecycle callbacks for a `TerminalWindowController`. Apps own the
/// lifecycle of terminal windows; the controller notifies the delegate
/// when its window is closing so the app can remove its reference.
@MainActor
public protocol TerminalWindowLifecycleDelegate: AnyObject {
    func terminalWindowWillClose(_ controller: TerminalWindowController)
}

/// Manages a single terminal window with its own session list.
@MainActor
public final class TerminalWindowController: SingleWindowController {

    public let sessionManager = TerminalSessionManager()
    public weak var lifecycleDelegate: TerminalWindowLifecycleDelegate?

    private var splitVC: TerminalSplitViewController?

    public init() {
        super.init(windowID: "terminal")
    }

    public override var windowTitle: String { "Terminal" }

    public override var defaultContentRect: NSRect {
        NSRect(x: 0, y: 0, width: 800, height: 600)
    }

    public override var windowStyleMask: NSWindow.StyleMask {
        [.titled, .closable, .miniaturizable, .resizable]
    }

    public override func makeContentViewController() -> NSViewController? {
        let svc = TerminalSplitViewController(sessionManager: sessionManager)
        splitVC = svc
        return svc
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
        splitVC?.toggleSidebar()
    }
}

extension TerminalWindowController: Loggable {
    public static nonisolated let logger = makeLogger()
}
