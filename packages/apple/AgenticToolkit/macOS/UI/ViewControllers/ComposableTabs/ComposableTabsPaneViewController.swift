import AppKit
import Combine

import AgenticToolkitCore
import AgenticToolkitCoreMacOS

/// One leaf of a tab: registry-vended content, plus — while arrange mode is on
/// — the scrim and toolbar that change the layout around it.
///
/// Nothing rearranges the layout while the user is working in it. Arrange mode
/// is a mode precisely so that the affordance can be big and central instead of
/// a small pull-down permanently in the corner of every pane.
@MainActor
public final class ComposableTabsPaneViewController: NSViewController {

    public let nodeID: UUID
    public let paneNumber: Int
    public let viewID: ComposableTabsViewID
    private weak var project: ProjectWorkspace?

    private var arrangeOverlay: ComposableTabsArrangeOverlayView?
    private var arrowKeyMonitor: Any?
    private var cancellables = Set<AnyCancellable>()

    public init(
        nodeID: UUID,
        paneNumber: Int,
        viewID: ComposableTabsViewID,
        project: ProjectWorkspace
    ) {
        self.nodeID = nodeID
        self.paneNumber = paneNumber
        self.viewID = viewID
        self.project = project
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    public required init?(coder: NSCoder) {
        fatalError("init(coder:) is not supported")
    }

    /// The registry-vended content, held as a child view controller so AppKit
    /// keeps it alive, routes appearance callbacks to it, and puts it in the
    /// responder chain. `nil` only if the project went away first.
    public private(set) var contentViewController: NSViewController?

    public override func loadView() {
        let container = ComposableTabsPaneBackgroundView(nodeID: nodeID)
        container.frame = NSRect(x: 0, y: 0, width: 300, height: 200)

        let content: NSView
        if let project = project {
            let contentVC = project.layout.registry.makeContentViewController(
                for: viewID,
                nodeID: nodeID,
                project: project,
                paneNumber: paneNumber
            )
            addChild(contentVC)
            contentViewController = contentVC
            content = contentVC.view
        } else {
            content = NSView(frame: container.bounds)
        }
        content.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(content)

        NSLayoutConstraint.activate([
            content.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: Self.borderInset),
            container.trailingAnchor.constraint(equalTo: content.trailingAnchor, constant: Self.borderInset),
            content.topAnchor.constraint(equalTo: container.topAnchor, constant: Self.borderInset),
            container.bottomAnchor.constraint(equalTo: content.bottomAnchor, constant: Self.borderInset)
        ])

        self.view = container
    }

    public override func viewDidLoad() {
        super.viewDidLoad()

        NotificationCenter.default.publisher(for: ComposableTabsArrangeMode.didChangeNotification)
            .sink { [weak self] notification in
                guard let self, let window = notification.object as? NSWindow,
                      window === self.view.window else { return }
                self.updateArrangeOverlay()
            }
            .store(in: &cancellables)

        // Any pane moving changes what every *other* pane may do — the last
        // pane in a column loses its `Up`, the last pane in the tab loses its
        // `Remove` — so availability is refreshed from the tree, not from the
        // pane that happened to act.
        NotificationCenter.default.publisher(for: ComposableTabsViewController.layoutDidChangeNotification)
            .sink { [weak self] _ in self?.arrangeOverlay?.refreshAvailability() }
            .store(in: &cancellables)

        // A closing window takes its panes with it without ever leaving arrange
        // mode, and `deinit` cannot touch the monitor — it is nonisolated.
        NotificationCenter.default.publisher(for: NSWindow.willCloseNotification)
            .sink { [weak self] notification in
                guard let self, let window = notification.object as? NSWindow,
                      window === self.view.window else { return }
                self.removeArrangeOverlay()
            }
            .store(in: &cancellables)
    }

    public override func viewDidAppear() {
        super.viewDidAppear()
        // Also the re-entry point after a move: `rebuild(from:)` re-hosts this
        // controller, and the pane has to come back with the scrim it left with.
        updateArrangeOverlay()
    }

    /// The active-pane border is drawn on the backdrop's own layer, so the
    /// content is held off its edge by that much or the border lands under it.
    private static let borderInset: CGFloat = 2

    /// Called by the enclosing split when this pane leaves the tree for good.
    /// The pane's content may be holding shells or file-system watchers, and
    /// "released at some point after the last reference drops" is not good
    /// enough for a child process.
    public func paneWillBeRemoved() {
        removeArrangeOverlay()
        (contentViewController as? PaneContentTeardown)?.paneContentWillBeDiscarded()
    }

    // MARK: - Arrange mode

    private var enclosingSplit: ComposableTabsViewController? {
        parent as? ComposableTabsViewController
    }

    /// What this pane is called, as the registry names it. The same string the
    /// Add popup offers, so a pane and the choice that made it match.
    private var paneName: String {
        let registry = (project?.layout ?? ComposableTabsLayout.placeholderOnly()).registry
        return registry.descriptor(for: viewID).displayName
    }

    private func updateArrangeOverlay() {
        if ComposableTabsArrangeMode.shared.isEnabled(in: view.window) {
            installArrangeOverlay()
        } else {
            removeArrangeOverlay()
        }
    }

    private func installArrangeOverlay() {
        guard arrangeOverlay == nil else {
            arrangeOverlay?.refreshAvailability()
            return
        }

        let overlay = ComposableTabsArrangeOverlayView(frame: view.bounds)
        overlay.translatesAutoresizingMaskIntoConstraints = false
        overlay.paneName = paneName
        overlay.canAdd = { [weak self] in self?.addChoices().isEmpty == false }
        overlay.canRemove = { [weak self] in
            guard let self else { return false }
            return self.enclosingSplit?.canRemoveLeaf(self) ?? false
        }
        overlay.availableDirections = { [weak self] in
            guard let self else { return [] }
            return self.enclosingSplit?.availableMoveDirections(for: self) ?? []
        }
        overlay.onAdd = { [weak self] in self?.presentAddSheet() }
        overlay.onRemove = { [weak self] in self?.confirmAndRemove() }
        overlay.onMove = { [weak self] direction in self?.move(direction) }
        overlay.onDone = { [weak self] in
            guard let window = self?.view.window else { return }
            ComposableTabsArrangeMode.shared.setEnabled(false, in: window)
        }

        // Above the content, inside the active-pane border.
        view.addSubview(overlay)
        NSLayoutConstraint.activate([
            overlay.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: Self.borderInset),
            view.trailingAnchor.constraint(equalTo: overlay.trailingAnchor, constant: Self.borderInset),
            overlay.topAnchor.constraint(equalTo: view.topAnchor, constant: Self.borderInset),
            view.bottomAnchor.constraint(equalTo: overlay.bottomAnchor, constant: Self.borderInset)
        ])
        arrangeOverlay = overlay
        overlay.refreshAvailability()

        installArrowKeyMonitor()
    }

    private func removeArrangeOverlay() {
        arrangeOverlay?.removeFromSuperview()
        arrangeOverlay = nil
        if let arrowKeyMonitor {
            NSEvent.removeMonitor(arrowKeyMonitor)
            self.arrowKeyMonitor = nil
        }
    }

    /// While arranging, an arrow key moves the selected pane — the fastest way
    /// to push a pane where you want it is to keep pressing the direction.
    ///
    /// A local monitor rather than `keyDown`: the pane's content owns the first
    /// responder (a terminal, an editor), and it would eat the arrow long
    /// before this controller saw it.
    private func installArrowKeyMonitor() {
        guard arrowKeyMonitor == nil else { return }
        arrowKeyMonitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { [weak self] event in
            guard let self else { return event }
            // Only the Bool crosses back out: `assumeIsolated` hands its result
            // across an isolation boundary, and NSEvent is not `Sendable`.
            let consumed = MainActor.assumeIsolated { self.handleKeyDown(event) }
            return consumed ? nil : event
        }
    }

    /// Return, Enter and Escape all mean "done arranging" — the mode is what
    /// they dismiss, and which of the three a person reaches for is a habit,
    /// not a distinction worth honouring.
    private static let exitKeyCodes: Set<UInt16> = [36, 76, 53]

    /// Whether the key was ours to act on, and was.
    private func handleKeyDown(_ event: NSEvent) -> Bool {
        guard let window = view.window,
              // Not the pane's own window means a sheet is up, and Escape
              // there cancels the sheet rather than the mode behind it.
              event.window === window,
              ComposableTabsArrangeMode.shared.isEnabled(in: window) else { return false }

        if Self.exitKeyCodes.contains(event.keyCode) {
            // Every pane in the window has a monitor, so this runs more than
            // once; turning the mode off twice is a no-op.
            ComposableTabsArrangeMode.shared.setEnabled(false, in: window)
            return true
        }

        // One monitor per pane, but only the pane the user selected moves.
        guard ComposableTabsActivePane.shared.activeNodeID(in: window) == nodeID,
              let direction = ComposableTabsViewController.Direction.allCases.first(
                where: { $0.arrowKeyCode == event.keyCode }) else { return false }
        move(direction)
        return true
    }

    private func move(_ direction: ComposableTabsViewController.Direction) {
        guard let split = enclosingSplit, split.move(self, direction) else {
            NSSound.beep()
            return
        }
    }

    /// The distinct views the spec will let this pane sit beside, named for the
    /// popup. Distinct, because the same view offered on two axes is one thing
    /// to add — the axis is the sheet's *other* question.
    private func addChoices() -> [ComposableTabsAddPaneViewController.Choice] {
        guard let split = enclosingSplit else { return [] }
        let registry = split.layout.registry
        var seen = Set<ComposableTabsViewID>()
        return split.allowedInsertions(beside: self).compactMap { insertion in
            // The placeholder is the fallback for content this build does not
            // have, not something anyone means to add. Offering it puts an
            // empty pane one click away in a menu of real ones.
            guard insertion.viewID != .placeholder else { return nil }
            guard seen.insert(insertion.viewID).inserted else { return nil }
            let descriptor = registry.descriptor(for: insertion.viewID)
            return ComposableTabsAddPaneViewController.Choice(
                viewID: insertion.viewID,
                displayName: descriptor.displayName,
                symbolName: descriptor.symbolName
            )
        }
    }

    private func presentAddSheet() {
        let choices = addChoices()
        guard !choices.isEmpty else {
            NSSound.beep()
            return
        }
        let picker = ComposableTabsAddPaneViewController(choices: choices) { [weak self] viewID, direction in
            guard let self else { return }
            self.enclosingSplit?.split(self, adding: viewID, direction: direction)
        }
        // A popover over the button that opened it, not a sheet off the title
        // bar: the question is about *this* pane, and a sheet drops it at the
        // top of a window that may hold five others.
        guard let anchor = arrangeOverlay?.addButtonView else {
            presentAsSheet(picker)
            return
        }
        present(picker, asPopoverRelativeTo: anchor.bounds, of: anchor, preferredEdge: .maxY, behavior: .transient)
    }

    /// Removing a pane can throw work away — a running shell, an unsaved edit —
    /// and the pane's content is the only thing that knows whether it would.
    private func confirmAndRemove() {
        guard let split = enclosingSplit, split.canRemoveLeaf(self) else {
            NSSound.beep()
            return
        }
        guard let warning = (contentViewController as? PaneContentRemovalConfirmation)?
            .removalConfirmationMessage else {
            split.remove(self)
            return
        }

        let alert = NSAlert()
        alert.alertStyle = .warning
        alert.messageText = "Remove this pane?"
        alert.informativeText = warning
        alert.addButton(withTitle: "Remove")
        alert.addButton(withTitle: "Cancel")

        guard let window = view.window else {
            if alert.runModal() == .alertFirstButtonReturn { split.remove(self) }
            return
        }
        alert.beginSheetModal(for: window) { response in
            MainActor.assumeIsolated {
                guard response == .alertFirstButtonReturn else { return }
                // Re-resolved: the sheet was up while the tree could change.
                self.enclosingSplit?.remove(self)
            }
        }
    }

    /// Whether the window's first responder lives inside this pane, so a
    /// removal can re-home focus rather than leaving the window without one.
    var containsFirstResponder: Bool {
        guard let responder = view.window?.firstResponder as? NSView else { return false }
        var current: NSView? = responder
        while let candidate = current {
            if candidate === view { return true }
            current = candidate.superview
        }
        return false
    }
}
