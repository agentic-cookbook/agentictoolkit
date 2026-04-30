import AppKit

/// Top-aligned tab bar header for `TabbedViewController`. Renders one
/// pill-style button per tab inside a horizontal `NSStackView`. Calls back
/// to its owner via closures so it stays decoupled from the controller's
/// public API.
@MainActor
final class TabBarView: NSView {

    static let preferredHeight: CGFloat = 28

    // MARK: - Tab metadata

    struct ItemModel {
        let id: UUID
        var title: String
    }

    // MARK: - Callbacks (set by TabbedViewController)

    var onSelect: ((UUID) -> Void)?
    var onClose: ((UUID) -> Void)?
    /// Fires after the user finishes dragging a tab to a new index. The
    /// stack view's underlying order is the source of truth before this
    /// call.
    var onReorder: ((UUID, Int) -> Void)?

    // MARK: - State

    private(set) var items: [ItemModel] = []
    private(set) var selectedID: UUID?

    // MARK: - Subviews

    private let stack = NSStackView()
    private let bottomDivider = NSView()
    private var buttons: [UUID: TabButton] = [:]

    // MARK: - Init

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        setUp()
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    private func setUp() {
        translatesAutoresizingMaskIntoConstraints = false

        stack.orientation = .horizontal
        stack.alignment = .centerY
        stack.spacing = 4
        stack.edgeInsets = NSEdgeInsets(top: 0, left: 8, bottom: 0, right: 8)
        stack.translatesAutoresizingMaskIntoConstraints = false

        bottomDivider.wantsLayer = true
        bottomDivider.layer?.backgroundColor = NSColor.separatorColor.cgColor
        bottomDivider.translatesAutoresizingMaskIntoConstraints = false

        addSubview(stack)
        addSubview(bottomDivider)

        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: topAnchor),
            stack.leadingAnchor.constraint(equalTo: leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: trailingAnchor),
            stack.bottomAnchor.constraint(equalTo: bottomDivider.topAnchor),

            bottomDivider.leadingAnchor.constraint(equalTo: leadingAnchor),
            bottomDivider.trailingAnchor.constraint(equalTo: trailingAnchor),
            bottomDivider.bottomAnchor.constraint(equalTo: bottomAnchor),
            bottomDivider.heightAnchor.constraint(equalToConstant: 1),

            heightAnchor.constraint(equalToConstant: Self.preferredHeight)
        ])
    }

    // MARK: - Public mutation

    func setItems(_ items: [ItemModel], selectedID: UUID?) {
        self.items = items
        self.selectedID = selectedID
        rebuildButtons()
    }

    func setSelected(_ id: UUID?) {
        selectedID = id
        for (buttonID, button) in buttons {
            button.isHighlighted = (buttonID == id)
        }
    }

    func renameItem(id: UUID, title: String) {
        if let idx = items.firstIndex(where: { $0.id == id }) {
            items[idx].title = title
            buttons[id]?.title = title
        }
    }

    // MARK: - Building

    private func rebuildButtons() {
        for view in stack.arrangedSubviews { view.removeFromSuperview() }
        buttons.removeAll()
        for item in items {
            let button = TabButton(id: item.id, title: item.title)
            button.isHighlighted = (item.id == selectedID)
            button.onSelect = { [weak self] id in self?.onSelect?(id) }
            button.onClose = { [weak self] id in self?.onClose?(id) }
            stack.addArrangedSubview(button)
            buttons[item.id] = button
        }
    }
}

// MARK: - TabButton

@MainActor
private final class TabButton: NSView {

    let id: UUID

    var title: String {
        didSet { titleLabel.stringValue = title }
    }

    var isHighlighted: Bool = false {
        didSet { updateAppearance() }
    }

    var onSelect: ((UUID) -> Void)?
    var onClose: ((UUID) -> Void)?

    private let titleLabel = NSTextField(labelWithString: "")
    private let closeButton = NSButton()
    private let backgroundView = NSView()

    init(id: UUID, title: String) {
        self.id = id
        self.title = title
        super.init(frame: .zero)

        translatesAutoresizingMaskIntoConstraints = false
        wantsLayer = true

        backgroundView.wantsLayer = true
        backgroundView.layer?.cornerRadius = 4
        backgroundView.translatesAutoresizingMaskIntoConstraints = false

        titleLabel.font = .systemFont(ofSize: NSFont.smallSystemFontSize)
        titleLabel.stringValue = title
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        titleLabel.lineBreakMode = .byTruncatingTail
        titleLabel.maximumNumberOfLines = 1

        closeButton.bezelStyle = .inline
        closeButton.isBordered = false
        closeButton.image = NSImage(systemSymbolName: "xmark.circle.fill", accessibilityDescription: "Close Tab")
        closeButton.imagePosition = .imageOnly
        closeButton.symbolConfiguration = .init(pointSize: 10, weight: .regular)
        closeButton.target = self
        closeButton.action = #selector(closeAction(_:))
        closeButton.translatesAutoresizingMaskIntoConstraints = false

        addSubview(backgroundView)
        backgroundView.addSubview(titleLabel)
        backgroundView.addSubview(closeButton)

        NSLayoutConstraint.activate([
            backgroundView.topAnchor.constraint(equalTo: topAnchor, constant: 2),
            backgroundView.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -2),
            backgroundView.leadingAnchor.constraint(equalTo: leadingAnchor),
            backgroundView.trailingAnchor.constraint(equalTo: trailingAnchor),

            titleLabel.leadingAnchor.constraint(equalTo: backgroundView.leadingAnchor, constant: 10),
            titleLabel.centerYAnchor.constraint(equalTo: backgroundView.centerYAnchor),

            closeButton.leadingAnchor.constraint(equalTo: titleLabel.trailingAnchor, constant: 6),
            closeButton.trailingAnchor.constraint(equalTo: backgroundView.trailingAnchor, constant: -6),
            closeButton.centerYAnchor.constraint(equalTo: backgroundView.centerYAnchor),
            closeButton.widthAnchor.constraint(equalToConstant: 14),
            closeButton.heightAnchor.constraint(equalToConstant: 14)
        ])

        updateAppearance()
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func mouseDown(with event: NSEvent) {
        let point = convert(event.locationInWindow, from: nil)
        if closeButton.frame.contains(convert(point, to: backgroundView)) {
            super.mouseDown(with: event)
            return
        }
        onSelect?(id)
    }

    @objc private func closeAction(_ sender: NSButton) {
        onClose?(id)
    }

    private func updateAppearance() {
        backgroundView.layer?.backgroundColor = isHighlighted
            ? NSColor.controlAccentColor.withAlphaComponent(0.18).cgColor
            : NSColor.clear.cgColor
        titleLabel.textColor = isHighlighted ? .labelColor : .secondaryLabelColor
    }
}
