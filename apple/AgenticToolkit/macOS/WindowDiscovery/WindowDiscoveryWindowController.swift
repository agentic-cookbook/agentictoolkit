import AgenticToolkitCoreUI
import AppKit

/// Manages the Window Discovery window lifecycle. Reuses a single window and
/// swaps its content view whenever `showDiscovery(for:)` is called with a new
/// session.
@MainActor
public final class WindowDiscoveryWindowController: SingleWindowController {

    private let container = NSView()
    private var discoveryView: WindowDiscoveryView?

    public init() { super.init(windowID: "windowDiscovery") }

    // MARK: - SingleWindowController overrides

    public override var windowTitle: String { "Window Discovery" }
    public override var defaultContentRect: NSRect { NSRect(x: 0, y: 0, width: 380, height: 420) }
    public override var minSize: NSSize? { NSSize(width: 300, height: 200) }

    public override func makeContentView() -> NSView? { container }

    // MARK: - Per-session presentation

    /// Shows the window discovery panel for the given session. Replaces any
    /// existing discovery view with a new one.
    public func showDiscovery(for session: Session) {
        let vm = WindowDiscoveryViewModel(session: session)
        vm.onWindowActivated = { [weak self] in
            self?.dismiss()
        }

        let view = WindowDiscoveryView(viewModel: vm)
        view.translatesAutoresizingMaskIntoConstraints = false

        showWindow()
        window?.title = "Window Discovery — \(session.projectName)"

        container.subviews.forEach { $0.removeFromSuperview() }
        container.addSubview(view)
        NSLayoutConstraint.activate([
            view.topAnchor.constraint(equalTo: container.topAnchor),
            view.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            view.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            view.bottomAnchor.constraint(equalTo: container.bottomAnchor),
        ])

        self.discoveryView = view
        Log.ui.debug("Window discovery shown for '\(session.projectName, privacy: .public)'")
    }
}
