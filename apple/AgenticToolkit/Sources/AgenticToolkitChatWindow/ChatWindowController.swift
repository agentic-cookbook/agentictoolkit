import AppKit

/// Manages a standalone AI Chat window.
@MainActor
public final class ChatWindowController: NSObject, NSWindowDelegate {
    private var window: NSWindow?
    private var chatView: ChatView?
    private let viewModel: ChatViewModel

    public init(viewModel: ChatViewModel) {
        self.viewModel = viewModel
    }

    public func showWindow() {
        if let window {
            window.makeKeyAndOrderFront(nil)
            NSApp.activate(ignoringOtherApps: true)
            return
        }

        let view = ChatView(viewModel: viewModel)
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
        w.center()

        // NSWindow initialized with a contentRect always has a contentView; guard
        // to keep the file free of force unwraps.
        guard let container = w.contentView else {
            preconditionFailure("NSWindow with contentRect unexpectedly has no contentView")
        }
        container.addSubview(view)
        NSLayoutConstraint.activate([
            view.topAnchor.constraint(equalTo: container.topAnchor),
            view.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            view.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            view.bottomAnchor.constraint(equalTo: container.bottomAnchor),
        ])

        w.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        self.window = w
    }

    public var isVisible: Bool {
        window?.isVisible ?? false
    }

    // MARK: - NSWindowDelegate (empty for now — host can add frame persistence)
}
