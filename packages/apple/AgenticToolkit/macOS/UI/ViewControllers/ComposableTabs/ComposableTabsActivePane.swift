import AppKit
import Combine

import AgenticToolkitCore
import AgenticToolkitCoreMacOS

/// Which pane the user last clicked in, tracked per window.
///
/// AppKit has no "the first responder changed" notification, and a pane's
/// content swallows its own mouse events long before the pane sees them, so the
/// click is caught once for the whole app rather than by every pane installing
/// a monitor of its own (`dry`). Per window, because two document windows each
/// have a pane the user is working in.
@MainActor
public final class ComposableTabsActivePane {

    public static let shared = ComposableTabsActivePane()

    /// Posted with the affected `NSWindow` as the object.
    public static let didChangeNotification =
        Notification.Name("AgenticToolkit.ComposableTabsActivePane.didChange")

    private var activeByWindow: [ObjectIdentifier: UUID] = [:]
    private var monitor: Any?
    private var cancellables = Set<AnyCancellable>()

    private init() {
        // Local, not global: this only cares about clicks in this app's own
        // windows, and a local monitor sees them before the responder chain
        // does without needing accessibility permission.
        monitor = NSEvent.addLocalMonitorForEvents(matching: [.leftMouseDown, .rightMouseDown]) { event in
            MainActor.assumeIsolated { ComposableTabsActivePane.shared.record(event) }
            return event
        }

        // Windows outlive nothing here, but their entries would: without this
        // the map grows by one dead key per closed document window.
        NotificationCenter.default.publisher(for: NSWindow.willCloseNotification)
            .compactMap { $0.object as? NSWindow }
            .receive(on: RunLoop.main)
            .sink { [weak self] window in
                self?.activeByWindow.removeValue(forKey: ObjectIdentifier(window))
            }
            .store(in: &cancellables)
    }

    public func activeNodeID(in window: NSWindow?) -> UUID? {
        guard let window else { return nil }
        return activeByWindow[ObjectIdentifier(window)]
    }

    public func activate(nodeID: UUID, in window: NSWindow) {
        let key = ObjectIdentifier(window)
        guard activeByWindow[key] != nodeID else { return }
        activeByWindow[key] = nodeID
        NotificationCenter.default.post(name: Self.didChangeNotification, object: window)
    }

    private func record(_ event: NSEvent) {
        guard let window = event.window,
              let contentView = window.contentView else { return }
        let point = contentView.convert(event.locationInWindow, from: nil)

        // The click landed on whatever the pane's content put there; the pane
        // it belongs to is the first backdrop out from it.
        var view = contentView.hitTest(point)
        while let candidate = view {
            if let background = candidate as? ComposableTabsPaneBackgroundView {
                activate(nodeID: background.nodeID, in: window)
                return
            }
            view = candidate.superview
        }
    }
}

/// A pane's backdrop, which also draws the "this is the pane you are working
/// in" border. It is one view rather than an overlay so the border can never
/// end up under the pane's content.
@MainActor
public final class ComposableTabsPaneBackgroundView: NSView, Themeable {

    public let nodeID: UUID

    private var observer: ThemePaletteObserver?
    private var cancellables = Set<AnyCancellable>()

    public init(nodeID: UUID) {
        self.nodeID = nodeID
        super.init(frame: .zero)
        self.wantsLayer = true

        observer = ThemePaletteObserver { [weak self] palette in self?.applyTheme(palette) }

        NotificationCenter.default.publisher(for: ComposableTabsActivePane.didChangeNotification)
            .sink { [weak self] notification in
                guard let self, let window = notification.object as? NSWindow,
                      window === self.window else { return }
                self.applyTheme(ThemePaletteObserver.currentPalette)
            }
            .store(in: &cancellables)

        UserSettings.shared.changes
            .filter { $0 == UserSettings.highlightActivePane.name }
            .receive(on: RunLoop.main)
            .sink { [weak self] _ in
                self?.applyTheme(ThemePaletteObserver.currentPalette)
            }
            .store(in: &cancellables)
    }

    @available(*, unavailable)
    public required init?(coder: NSCoder) { fatalError() }

    public override func viewDidMoveToWindow() {
        super.viewDidMoveToWindow()
        // A window that has never been clicked in still has a pane the user is
        // typing into, so the first pane to appear claims the border.
        if let window, ComposableTabsActivePane.shared.activeNodeID(in: window) == nil {
            ComposableTabsActivePane.shared.activate(nodeID: nodeID, in: window)
        }
        applyTheme(ThemePaletteObserver.currentPalette)
    }

    public func applyTheme(_ palette: SemanticPalette) {
        layer?.backgroundColor = palette.nsColor(.windowBackground).cgColor

        let isActive = UserSettings.highlightActivePane.value
            && ComposableTabsActivePane.shared.activeNodeID(in: window) == nodeID
        layer?.borderWidth = isActive ? 2 : 0
        layer?.borderColor = isActive ? palette.nsColor(.accent).cgColor : nil
    }
}
