import AppKit
import AgenticToolkitCore
import AgenticToolkitCoreUI
import AgenticToolkitCoreMacOS
import os

/// Manages the Window Discovery window lifecycle. Reuses a single window and
/// swaps its content view whenever `showDiscovery(for:)` is called with a new
/// session.
@MainActor
public final class WindowDiscoveryWindowController: WindowController<WindowContentViewController<NSView>> {

    private var discoveryView: WindowDiscoveryView?

    public static let windowID = "windowDiscovery"

    public init() {
        let container = NSView()
        super.init(
            windowID: Self.windowID,
            contentViewController: WindowContentViewController<NSView>(contentView: container)
        )
        self.windowSpec = WindowSpec(
            defaultSize: NSSize(width: 380, height: 420),
            minSize: NSSize(width: 300, height: 200),
            defaultPosition: .center,
            persistsFrame: true
        )
        self.windowTitle = "Window Discovery"
        self.minSize = NSSize(width: 300, height: 200)
    }

    private var container: NSView {
        viewController?.contentView ?? NSView()
    }

    // MARK: - Per-session presentation

    /// Shows the window discovery panel for the given session. Replaces any
    /// existing discovery view with a new one.
    public func showDiscovery(for session: SessionWatcher.SessionWatcherSession) {
        let vm = WindowDiscoveryViewModel(session: session)
        vm.onWindowActivated = { [weak self] in
            self?.dismiss()
        }

        let view = WindowDiscoveryView(viewModel: vm)
        view.translatesAutoresizingMaskIntoConstraints = false

        showWindow()
        window?.title = "Window Discovery — \(session.projectName)"

        let host = container
        host.subviews.forEach { $0.removeFromSuperview() }
        host.addSubview(view)
        NSLayoutConstraint.activate([
            view.topAnchor.constraint(equalTo: host.topAnchor),
            view.leadingAnchor.constraint(equalTo: host.leadingAnchor),
            view.trailingAnchor.constraint(equalTo: host.trailingAnchor),
            view.bottomAnchor.constraint(equalTo: host.bottomAnchor),
        ])

        self.discoveryView = view
        logger.debug("Window discovery shown for '\(session.projectName, privacy: .public)'")
    }
}

extension WindowDiscoveryWindowController: Loggable {
    public static nonisolated let logger = makeLogger()
}
