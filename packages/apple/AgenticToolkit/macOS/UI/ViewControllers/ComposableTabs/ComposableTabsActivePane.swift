import AppKit
import Combine

import AgenticToolkitCore
import AgenticToolkitCoreMacOS

/// Which pane the user is working in, tracked per window: the one they last
/// clicked in, or — with `activePaneFollowsMouse` on — the one under the
/// pointer.
///
/// AppKit has no "the first responder changed" notification, and a pane's
/// content swallows its own mouse events long before the pane sees them, so the
/// click is caught once for the whole app rather than by every pane installing
/// a monitor of its own (`dry`). Per window, because two document windows each
/// have a pane the user is working in.
///
/// The pointer arrives through the same monitor as the click, and through the
/// same hit test: "which pane is this point in" is one question with one
/// answer, and a second implementation of it in a tracking area would be a
/// second thing to keep in step with the view tree.
@MainActor
public final class ComposableTabsActivePane {

    public static let shared = ComposableTabsActivePane()

    /// Posted with the affected `NSWindow` as the object.
    public static let didChangeNotification =
        Notification.Name("AgenticToolkit.ComposableTabsActivePane.didChange")

    private var activeByWindow: [ObjectIdentifier: UUID] = [:]
    private var monitor: Any?
    private var cancellables = Set<AnyCancellable>()

    /// The windows holding panes, so that switching the setting on reaches the
    /// windows that were already open rather than only the next one. Weak: this
    /// is a convenience list, never an owner, and a closed window has to be
    /// able to go away without being told twice.
    private let paneWindows = NSHashTable<NSWindow>.weakObjects()

    private var followsMouseObserver: UserSettingObserver<Bool>?

    private init() {
        // Local, not global: this only cares about the pointer in this app's
        // own windows, and a local monitor sees the events before the responder
        // chain does without needing accessibility permission.
        monitor = NSEvent.addLocalMonitorForEvents(
            matching: [.leftMouseDown, .rightMouseDown, .mouseMoved]
        ) { event in
            MainActor.assumeIsolated { ComposableTabsActivePane.shared.record(event) }
            return event
        }

        followsMouseObserver = UserSettingObserver(UserSettings.activePaneFollowsMouse) { [weak self] _ in
            guard let self else { return }
            for window in paneWindows.allObjects { acceptMouseMoved(in: window) }
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

    /// Whether `view` sits inside the pane the user is working in.
    ///
    /// A view in no pane at all — the standalone terminal window, the quick
    /// note panel — counts as active: "not the active pane" has to mean
    /// *another* pane holds the user, not that there are no panes to hold them.
    /// Same for a window no pane has claimed yet, which is a state that lasts
    /// until the first backdrop reaches a window.
    ///
    /// Deliberately blind to whether the window is key. What it answers is
    /// which pane the user is working in, and that does not change because a
    /// settings window came forward — a pane content that dimmed itself every
    /// time the user opened Settings would be reporting the wrong thing at
    /// exactly the moment they were looking.
    public func isInActivePane(_ view: NSView) -> Bool {
        var candidate: NSView? = view
        while let current = candidate {
            if let background = current as? ComposableTabsPaneBackgroundView {
                guard let active = activeNodeID(in: view.window) else { return true }
                return active == background.nodeID
            }
            candidate = current.superview
        }
        return true
    }

    public func activate(nodeID: UUID, in window: NSWindow) {
        let key = ObjectIdentifier(window)
        guard activeByWindow[key] != nodeID else { return }
        activeByWindow[key] = nodeID
        NotificationCenter.default.post(name: Self.didChangeNotification, object: window)
    }

    /// Told by each pane's backdrop as it lands in a window.
    ///
    /// The window is kept so a later change to `activePaneFollowsMouse` can
    /// reach it, and the first pane to arrive claims the active spot: a window
    /// nobody has clicked in yet still has a pane the user is typing into.
    public func paneDidAppear(nodeID: UUID, in window: NSWindow) {
        paneWindows.add(window)
        acceptMouseMoved(in: window)
        if activeNodeID(in: window) == nil {
            activate(nodeID: nodeID, in: window)
        }
    }

    /// Switched on, and never back off. `acceptsMouseMovedEvents` is the
    /// window's, not this class's — anything else in the window may have asked
    /// for the same events — so turning the setting off stops this tracker
    /// acting on moves rather than stopping the window from hearing about them.
    /// What that costs is events this class ignores.
    private func acceptMouseMoved(in window: NSWindow) {
        guard UserSettings.activePaneFollowsMouse.currentValue else { return }
        window.acceptsMouseMovedEvents = true
    }

    private func record(_ event: NSEvent) {
        guard let window = event.window else { return }
        let following = event.type == .mouseMoved
        if following, !followsMouse(in: window) { return }

        guard let chain = paneChain(under: event, in: window),
              let background = chain.last as? ComposableTabsPaneBackgroundView else { return }

        // A click that has not moved the user is a click inside the pane they
        // are already in, and there is nothing to say about it. The pointer
        // merely passing through is the same thing said far more often — and
        // taking the keyboard again on every one of those moves would interrupt
        // whatever the user was doing with it inside the pane.
        guard activeNodeID(in: window) != background.nodeID else { return }
        activate(nodeID: background.nodeID, in: window)

        // A click carries its own focus: the view under it takes first
        // responder the ordinary AppKit way. The pointer carries nothing, so a
        // pane it moves into would be outlined as active while the keys kept
        // going to the pane the user left.
        if following { takeFocus(within: chain, in: window) }
    }

    /// Whether the pointer is entitled to move the active pane in this window.
    private func followsMouse(in window: NSWindow) -> Bool {
        guard UserSettings.activePaneFollowsMouse.currentValue else { return false }
        // The pointer resting over a window behind the front one says nothing
        // about where the user is typing — the key window still has the keys.
        // A sheet has them outright, and it is the sheet the user is answering.
        guard window.isKeyWindow, window.attachedSheet == nil else { return false }
        // Arrange mode is for moving panes about rather than working in them,
        // and its toolbar is what the keyboard belongs to while it is on.
        return !ComposableTabsArrangeMode.shared.isEnabled(in: window)
    }

    /// The views under the pointer, innermost first, out to the pane's backdrop
    /// — or `nil` when the point is not inside a pane at all.
    private func paneChain(under event: NSEvent, in window: NSWindow) -> [NSView]? {
        guard let contentView = window.contentView else { return nil }
        let point = contentView.convert(event.locationInWindow, from: nil)

        // The point landed on whatever the pane's content put there; the pane
        // it belongs to is the first backdrop out from it.
        var chain: [NSView] = []
        var view = contentView.hitTest(point)
        while let candidate = view {
            chain.append(candidate)
            if candidate is ComposableTabsPaneBackgroundView { return chain }
            view = candidate.superview
        }
        return nil
    }

    /// Hand the keyboard to whatever a click at this point would have handed it
    /// to: the innermost view under the pointer that will take it.
    ///
    /// Walking out from the pointer rather than asking the pane for one answer
    /// is what lets a pane with two things to type in — a file browser's list
    /// and the filter field above it — give the keys to the one the pointer is
    /// actually over. A pane with nothing to type in keeps the outline and
    /// leaves the first responder where it was, which is the honest outcome:
    /// there was nowhere in it for the keys to go.
    private func takeFocus(within chain: [NSView], in window: NSWindow) {
        for view in chain where view.acceptsFirstResponder {
            guard window.firstResponder !== view else { return }
            window.makeFirstResponder(view)
            return
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

        // Two windows both drawing "the pane you are working in" is a lie —
        // only one of them is. Unfiltered because a key change moves focus
        // *between* windows: the one losing it has to redraw too.
        Publishers.Merge(
            NotificationCenter.default.publisher(for: NSWindow.didBecomeKeyNotification),
            NotificationCenter.default.publisher(for: NSWindow.didResignKeyNotification)
        )
        .sink { [weak self] _ in
            self?.applyTheme(ThemePaletteObserver.currentPalette)
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
        if let window {
            ComposableTabsActivePane.shared.paneDidAppear(nodeID: nodeID, in: window)
        }
        applyTheme(ThemePaletteObserver.currentPalette)
    }

    /// A sheet takes key from the window it is attached to, and the pane
    /// underneath is still the one the user is working in — so the document
    /// window counts as focused while it holds one.
    private var isWindowFocused: Bool {
        guard let window else { return false }
        return window.isKeyWindow || window.attachedSheet?.isKeyWindow == true
    }

    public func applyTheme(_ palette: SemanticPalette) {
        layer?.backgroundColor = palette.nsColor(.windowBackground).cgColor

        // A theme may override both the switch and the color; neither is set
        // until the user edits the theme's Project topic, so by default the
        // Projects settings panel decides.
        let overrides = palette.theme.project
        let highlights = overrides?.highlightActivePane ?? UserSettings.highlightActivePane.value
        let isActive = highlights
            && isWindowFocused
            && ComposableTabsActivePane.shared.activeNodeID(in: window) == nodeID
        layer?.borderWidth = isActive ? 2 : 0
        // The outline gray, not the accent: this rectangle says which pane you
        // are in, and it sits around content the user is reading, so a
        // saturated frame would compete with what is inside it. It is also not
        // a *surface* tone — the first version drew it in the raised-surface
        // gray, which is now the color of the backdrop the pane sits on, and a
        // line the color of the plane behind it is a line nobody can see.
        layer?.borderColor = isActive ? NSColor(palette.projectPaneOutline).cgColor : nil
    }
}
