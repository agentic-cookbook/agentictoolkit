import AppKit
import AgenticPluginSDK
import AgenticUI

/// Manages a standalone AI Chat window using AgenticUI's ChatView and ChatViewModel.
final class AIChatWindowController: NSObject, NSWindowDelegate {
    private var window: NSWindow?
    private var chatView: ChatView?
    private(set) var chatViewModel: ChatViewModel?
    private weak var settingsWindowController: SettingsWindowController?

    init(settingsWindowController: SettingsWindowController) {
        self.settingsWindowController = settingsWindowController
    }

    func showWindow() {
        if let window {
            window.makeKeyAndOrderFront(nil)
            NSApp.activate(ignoringOtherApps: true)
            return
        }

        guard let swc = settingsWindowController else { return }

        // Ensure view models exist (creates them lazily without showing settings)
        if swc.aiSettingsViewModel == nil {
            swc.ensureViewModel()
        }

        guard let aiVM = swc.aiSettingsViewModel else { return }
        let chatVM = ChatViewModel(pluginManager: aiVM.pluginManager, configProvider: aiVM)
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
