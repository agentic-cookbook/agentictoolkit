import AppKit
import AgenticToolkitCore
import AgenticToolkitCoreUI
import AgenticToolkitChatWindow
import AgenticToolkitSettingsWindow

/// Manages a standalone AI Chat window using the toolkit's `ChatView` +
/// `ChatViewModel`. The live plugin-backed chat path (`PluginChatBackend`) is
/// parked pending the per-plugin-secrets redesign, so this wires a
/// `StubChatBackend` that keeps the UI visible but rejects sends.
@MainActor
final class AIChatWindowController: NSObject, NSWindowDelegate {
    private var window: NSWindow?
    private var chatView: ChatView?
    private(set) var chatViewModel: ChatViewModel?

    func showWindow() {
        if let window {
            window.makeKeyAndOrderFront(nil)
            NSApp.activate(ignoringOtherApps: true)
            return
        }

        let backend = StubChatBackend()
        let chatVM = ChatViewModel(backend: backend)
        self.chatViewModel = chatVM

        let view = ChatView(viewModel: chatVM)
        view.translatesAutoresizingMaskIntoConstraints = false
        self.chatView = view

        let w = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 420, height: 520),
            styleMask: [.titled, .closable, .resizable, .miniaturizable],
            backing: .buffered,
            defer: false
        )
        w.title = "AI Chat"
        w.isReleasedWhenClosed = false
        w.delegate = self

        let container = w.contentView!
        container.addSubview(view)
        NSLayoutConstraint.activate([
            view.topAnchor.constraint(equalTo: container.topAnchor),
            view.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            view.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            view.bottomAnchor.constraint(equalTo: container.bottomAnchor),
        ])

        WindowManager.shared.restoreFrame(for: w, id: "aiChat")

        w.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        self.window = w
    }

    var isVisible: Bool {
        window?.isVisible ?? false
    }

    // MARK: - NSWindowDelegate

    func windowDidMove(_ notification: Notification) {
        guard let window = notification.object as? NSWindow else { return }
        WindowManager.shared.saveFrame(for: window, id: "aiChat")
    }

    func windowDidResize(_ notification: Notification) {
        guard let window = notification.object as? NSWindow else { return }
        WindowManager.shared.saveFrame(for: window, id: "aiChat")
    }
}
