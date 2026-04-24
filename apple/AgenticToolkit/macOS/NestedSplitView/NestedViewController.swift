import AppKit

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

    public override func loadView() {
        let container = NSView(frame: NSRect(x: 0, y: 0, width: 300, height: 200))

        let content: NSView
        if let document = splitDocument {
            content = NestedContentRegistry.makeView(
                for: contentTypeIdentifier,
                nodeID: nodeID,
                document: document,
                paneNumber: paneNumber
            )
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
            splitButton.trailingAnchor.constraint(equalTo: container.trailingAnchor, constant: -8),
        ])

        self.view = container
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
        return button
    }

    @objc private func splitSelected(_ sender: NSMenuItem) {
        guard let direction = sender.representedObject as? NestingSplitViewController.Direction,
              let parent = parent as? NestingSplitViewController else { return }
        parent.split(self, direction: direction)
    }

    private static let menuItems: [(String, NestingSplitViewController.Direction)] = [
        ("Split Left", .left),
        ("Split Right", .right),
        ("Split Above", .above),
        ("Split Below", .below),
    ]
}
