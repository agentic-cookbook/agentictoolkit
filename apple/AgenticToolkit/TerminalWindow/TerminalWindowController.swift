import AppKit
import CoreUI
import os

private let windowLog = Logger(subsystem: "com.agentictoolkit.AgenticTerminalKit", category: "Terminal")

/// Lifecycle callbacks for a `TerminalWindowController`. Apps own the
/// lifecycle of terminal windows; the controller notifies the delegate
/// when its window is closing so the app can remove its reference.
@MainActor
public protocol TerminalWindowLifecycleDelegate: AnyObject {
    func terminalWindowWillClose(_ controller: TerminalWindowController)
}

/// Manages a single terminal window with its own session list.
@MainActor
public final class TerminalWindowController: NSWindowController, NSWindowDelegate {

    private let windowID = "terminal"

    public let sessionManager = TerminalSessionManager()
    public weak var lifecycleDelegate: TerminalWindowLifecycleDelegate?

    private var splitVC: TerminalSplitViewController!

    public init() {
        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 800, height: 600),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "Terminal"
        window.isReleasedWhenClosed = false

        super.init(window: window)
        window.delegate = self

        splitVC = TerminalSplitViewController(sessionManager: sessionManager)
        window.contentViewController = splitVC

        _ = WindowManager.shared.restoreFrame(for: window, id: windowID)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

    public override func showWindow(_ sender: Any?) {
        super.showWindow(sender)
        if sessionManager.sessions.isEmpty {
            sessionManager.addSession()
        }
    }

    public func windowWillClose(_ notification: Notification) {
        sessionManager.terminateAll()
        windowLog.info("Terminal window closed, sessions terminated")
        lifecycleDelegate?.terminalWindowWillClose(self)
    }

    public func windowDidMove(_ notification: Notification) {
        if let window { WindowManager.shared.saveFrame(for: window, id: windowID) }
    }

    public func windowDidResize(_ notification: Notification) {
        if let window { WindowManager.shared.saveFrame(for: window, id: windowID) }
    }

    public func toggleSidebar() {
        splitVC.toggleSidebar()
    }
}
