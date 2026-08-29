import AppKit
import AgenticToolkitCore
import AgenticToolkitCoreMacOS

@MainActor
public final class NestedViewController: NSViewController {

    public let nodeID: UUID
    public let paneNumber: Int
    public let contentTypeIdentifier: String
    private weak var splitDocument: NestedSplitViewDocument?

    public init(
        nodeID: UUID,
        paneNumber: Int,
        contentTypeIdentifier: String,
        document: NestedSplitViewDocument
    ) {
        self.nodeID = nodeID
        self.paneNumber = paneNumber
        self.contentTypeIdentifier = contentTypeIdentifier
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
            let contentVC = NestedContentRegistry.makeContentViewController(
                for: contentTypeIdentifier,
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

    private func makeSplitButton() -> NSPopUpButton {
        let button = NSPopUpButton(frame: .zero, pullsDown: true)
        button.bezelStyle = .rounded
        button.addItem(withTitle: "Split")
        for (title, direction) in Self.menuItems {
            let item = NSMenuItem(
                title: title,
                action: #selector(splitSelected(_:)),
                keyEquivalent: ""
            )
            item.target = self
            item.representedObject = direction
            button.menu?.addItem(item)
        }
        button.menu?.addItem(.separator())
        let remove = NSMenuItem(
            title: "Remove",
            action: #selector(removeSelected(_:)),
            keyEquivalent: ""
        )
        remove.target = self
        button.menu?.addItem(remove)
        // "Remove" is enabled from the *tab's* pane count, which AppKit's
        // automatic validation cannot see, so enablement is decided in
        // `menuNeedsUpdate(_:)` instead.
        button.menu?.autoenablesItems = false
        button.menu?.delegate = self
        return button
    }

    @objc private func splitSelected(_ sender: NSMenuItem) {
        guard let direction = sender.representedObject as? NestingSplitViewController.Direction,
              let parent = parent as? NestingSplitViewController else { return }
        parent.split(self, direction: direction)
    }

    @objc private func removeSelected(_ sender: NSMenuItem) {
        guard let parent = parent as? NestingSplitViewController else { return }
        parent.remove(self)
    }

    /// False for the last pane in the tab — a tab always keeps at least one.
    private var canRemove: Bool {
        guard let parent = parent as? NestingSplitViewController,
              let root = parent.rootSplit() else { return false }
        return root.leafCount() > 1
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

    private static let menuItems: [(String, NestingSplitViewController.Direction)] = [
        ("Split Left", .left),
        ("Split Right", .right),
        ("Split Above", .above),
        ("Split Below", .below)
    ]
}

extension NestedViewController: NSMenuDelegate {

    public func menuNeedsUpdate(_ menu: NSMenu) {
        guard let item = menu.items.first(where: { $0.action == #selector(removeSelected(_:)) }) else {
            return
        }
        item.isEnabled = canRemove
    }
}
