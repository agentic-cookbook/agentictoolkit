import AppKit
import AgenticToolkitCore
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
public final class TerminalSessionWindowController: SingleWindowController {

    public let sessionManager = TerminalSessionManager()
    public weak var lifecycleDelegate: TerminalSessionWindowLifecycleDelegate?

    private var splitVC: TerminalSessionSplitViewController?

    public static let windowID = "terminal"
    public static let windowSpec = WindowSpec(
        defaultSize: NSSize(width: 800, height: 600),
        minSize: NSSize(width: 600, height: 400),
        defaultPosition: .center,
        persistsFrame: true
    )

    public init() {
        super.init(windowID: Self.windowID, spec: Self.windowSpec)
    }

    public override var windowTitle: String { "Terminal" }

    public override var defaultContentRect: NSRect {
        NSRect(x: 0, y: 0, width: 800, height: 600)
    }

    public override var windowStyleMask: NSWindow.StyleMask {
        [.titled, .closable, .miniaturizable, .resizable]
    }

    public override func makeContentViewController() -> NSViewController? {
        let svc = TerminalSessionSplitViewController(sessionManager: sessionManager)
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

extension TerminalSessionWindowController: Loggable {
    public static nonisolated let logger = makeLogger()
}
