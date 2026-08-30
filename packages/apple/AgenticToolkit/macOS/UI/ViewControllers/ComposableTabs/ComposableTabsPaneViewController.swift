import AppKit
import AgenticToolkitCore
import AgenticToolkitCoreMacOS

/// One leaf of a tab: registry-vended content, plus the pull-down that changes
/// the layout around it.
@MainActor
public final class ComposableTabsPaneViewController: NSViewController {

    public let nodeID: UUID
    public let paneNumber: Int
    public let viewID: ComposableTabsViewID
    private weak var splitDocument: ComposableTabsDocument?

    public init(
        nodeID: UUID,
        paneNumber: Int,
        viewID: ComposableTabsViewID,
        document: ComposableTabsDocument
    ) {
        self.nodeID = nodeID
        self.paneNumber = paneNumber
        self.viewID = viewID
        self.splitDocument = document
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    public required init?(coder: NSCoder) {
        fatalError("init(coder:) is not supported")
    }

    /// The registry-vended content, held as a child view controller so AppKit
    /// keeps it alive, routes appearance callbacks to it, and puts it in the
    /// responder chain. `nil` only if the document went away first.
    public private(set) var contentViewController: NSViewController?

    public override func loadView() {
        let container = ThemedBackgroundView(role: .windowBackground)
        container.frame = NSRect(x: 0, y: 0, width: 300, height: 200)

        let content: NSView
        if let document = splitDocument {
            let contentVC = document.layout.registry.makeContentViewController(
                for: viewID,
                nodeID: nodeID,
                document: document,
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

        let splitButton = makeSplitButton()
        splitButton.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(splitButton)

        NSLayoutConstraint.activate([
            content.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            content.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            content.topAnchor.constraint(equalTo: container.topAnchor),
            content.bottomAnchor.constraint(equalTo: container.bottomAnchor),

            splitButton.topAnchor.constraint(equalTo: container.topAnchor, constant: 8),
            splitButton.trailingAnchor.constraint(equalTo: container.trailingAnchor, constant: -8)
        ])

        self.view = container
    }

    /// Called by the enclosing split when this pane leaves the tree for good.
    /// The pane's content may be holding shells or file-system watchers, and
    /// "released at some point after the last reference drops" is not good
    /// enough for a child process.
    public func paneWillBeRemoved() {
        (contentViewController as? PaneContentTeardown)?.paneContentWillBeDiscarded()
    }

    // MARK: - The Split menu

    private func makeSplitButton() -> NSPopUpButton {
        let button = NSPopUpButton(frame: .zero, pullsDown: true)
        button.bezelStyle = .rounded
        button.addItem(withTitle: "Split")
        button.accessibilityID("composable-tabs.pane.split-menu")
        // Contents change with the tree, so the menu is rebuilt each time it
        // opens rather than assembled once here.
        button.menu?.autoenablesItems = false
        button.menu?.delegate = self
        return button
    }

    /// One "Add <View> <Direction>" per legal insertion, in the direction the
    /// spec (or the view's own descriptor) prefers, plus the other axis after
    /// it — a preferred axis picks what is offered first, it does not forbid
    /// the other one. Then `Remove`.
    ///
    /// This is the payoff of the whole abstraction: the menu is not four fixed
    /// directions duplicating the current pane's content, it is what the spec
    /// says may go here.
    fileprivate func rebuildSplitMenu(_ menu: NSMenu) {
        // Item 0 is the pull-down's own title, which never appears in the list.
        let title = menu.items.first
        menu.removeAllItems()
        if let title { menu.addItem(title) }

        guard let parent = parent as? ComposableTabsViewController else { return }
        let registry = parent.layout.registry

        for insertion in parent.allowedInsertions(beside: self) {
            let descriptor = registry.descriptor(for: insertion.viewID)
            let axes = [insertion.preferredAxis, insertion.preferredAxis.perpendicular]
            for direction in axes.flatMap({ ComposableTabsViewController.Direction.directions(along: $0) }) {
                let item = NSMenuItem(
                    title: "Add \(descriptor.displayName) \(Self.word(for: direction))",
                    action: #selector(insertSelected(_:)),
                    keyEquivalent: ""
                )
                item.target = self
                item.representedObject = Insertion(viewID: insertion.viewID, direction: direction)
                item.isEnabled = true
                if let symbolName = descriptor.symbolName {
                    item.image = NSImage(
                        systemSymbolName: symbolName, accessibilityDescription: descriptor.displayName)
                }
                menu.addItem(item)
            }
        }

        menu.addItem(.separator())
        let remove = NSMenuItem(
            title: "Remove",
            action: #selector(removeSelected(_:)),
            keyEquivalent: ""
        )
        remove.target = self
        // Enablement comes from the *tab's* tree, which AppKit's automatic
        // validation cannot see.
        remove.isEnabled = parent.canRemoveLeaf(self)
        menu.addItem(remove)
    }

    /// What one menu item does, carried on the item itself.
    private final class Insertion: NSObject {
        let viewID: ComposableTabsViewID
        let direction: ComposableTabsViewController.Direction

        init(viewID: ComposableTabsViewID, direction: ComposableTabsViewController.Direction) {
            self.viewID = viewID
            self.direction = direction
        }
    }

    private static func word(for direction: ComposableTabsViewController.Direction) -> String {
        switch direction {
        case .left: return "Left"
        case .right: return "Right"
        case .above: return "Above"
        case .below: return "Below"
        }
    }

    @objc private func insertSelected(_ sender: NSMenuItem) {
        guard let insertion = sender.representedObject as? Insertion,
              let parent = parent as? ComposableTabsViewController else { return }
        parent.split(self, adding: insertion.viewID, direction: insertion.direction)
    }

    @objc private func removeSelected(_ sender: NSMenuItem) {
        guard let parent = parent as? ComposableTabsViewController else { return }
        parent.remove(self)
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

extension ComposableTabsPaneViewController: NSMenuDelegate {

    public func menuNeedsUpdate(_ menu: NSMenu) {
        rebuildSplitMenu(menu)
    }
}
