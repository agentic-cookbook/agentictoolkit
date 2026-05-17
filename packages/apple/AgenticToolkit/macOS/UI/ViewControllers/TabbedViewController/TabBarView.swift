import AppKit

/// Edge-aligned tab bar header for `TabbedViewController`. Renders one
/// pill-style button per tab inside an `NSStackView` whose orientation
/// follows the bar's `Edge`. Calls back to its owner via closures so it
/// stays decoupled from the controller's public API.
@MainActor
final class TabBarView: NSView {

    /// The bar's narrow dimension — height for top/bottom, width for left/right.
    static func preferredThickness(for edge: Edge) -> CGFloat {
        switch edge {
        case .top, .bottom: return 28
        case .left, .right: return 140
        }
    }

    let edge: Edge

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
    private let edgeDivider = NSView()
    private var buttons: [UUID: TabButton] = [:]

    // MARK: - Init

    init(edge: Edge) {
        self.edge = edge
        super.init(frame: .zero)
        setUp()
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    private func setUp() {
        translatesAutoresizingMaskIntoConstraints = false

        switch edge {
        case .top, .bottom:
            stack.orientation = .horizontal
            stack.alignment = .centerY
            stack.edgeInsets = NSEdgeInsets(top: 0, left: 8, bottom: 0, right: 8)
        case .left, .right:
            stack.orientation = .vertical
            stack.alignment = .leading
            stack.edgeInsets = NSEdgeInsets(top: 8, left: 8, bottom: 8, right: 8)
        }
        stack.spacing = 4
        stack.translatesAutoresizingMaskIntoConstraints = false

        edgeDivider.wantsLayer = true
        edgeDivider.layer?.backgroundColor = NSColor.separatorColor.cgColor
        edgeDivider.translatesAutoresizingMaskIntoConstraints = false

        addSubview(stack)
        addSubview(edgeDivider)

        let thickness = Self.preferredThickness(for: edge)

        switch edge {
        case .top:
            NSLayoutConstraint.activate([
                heightAnchor.constraint(equalToConstant: thickness),
                stack.topAnchor.constraint(equalTo: topAnchor),
                stack.leadingAnchor.constraint(equalTo: leadingAnchor),
                stack.trailingAnchor.constraint(equalTo: trailingAnchor),
                stack.bottomAnchor.constraint(equalTo: edgeDivider.topAnchor),

                edgeDivider.leadingAnchor.constraint(equalTo: leadingAnchor),
                edgeDivider.trailingAnchor.constraint(equalTo: trailingAnchor),
                edgeDivider.bottomAnchor.constraint(equalTo: bottomAnchor),
                edgeDivider.heightAnchor.constraint(equalToConstant: 1)
            ])
        case .bottom:
            NSLayoutConstraint.activate([
                heightAnchor.constraint(equalToConstant: thickness),
                edgeDivider.leadingAnchor.constraint(equalTo: leadingAnchor),
                edgeDivider.trailingAnchor.constraint(equalTo: trailingAnchor),
                edgeDivider.topAnchor.constraint(equalTo: topAnchor),
                edgeDivider.heightAnchor.constraint(equalToConstant: 1),

                stack.topAnchor.constraint(equalTo: edgeDivider.bottomAnchor),
                stack.leadingAnchor.constraint(equalTo: leadingAnchor),
                stack.trailingAnchor.constraint(equalTo: trailingAnchor),
                stack.bottomAnchor.constraint(equalTo: bottomAnchor)
            ])
        case .left:
            NSLayoutConstraint.activate([
                widthAnchor.constraint(equalToConstant: thickness),
                stack.topAnchor.constraint(equalTo: topAnchor),
                stack.bottomAnchor.constraint(equalTo: bottomAnchor),
                stack.leadingAnchor.constraint(equalTo: leadingAnchor),
                stack.trailingAnchor.constraint(equalTo: edgeDivider.leadingAnchor),

                edgeDivider.topAnchor.constraint(equalTo: topAnchor),
                edgeDivider.bottomAnchor.constraint(equalTo: bottomAnchor),
                edgeDivider.trailingAnchor.constraint(equalTo: trailingAnchor),
                edgeDivider.widthAnchor.constraint(equalToConstant: 1)
            ])
        case .right:
            NSLayoutConstraint.activate([
                widthAnchor.constraint(equalToConstant: thickness),
                edgeDivider.topAnchor.constraint(equalTo: topAnchor),
                edgeDivider.bottomAnchor.constraint(equalTo: bottomAnchor),
                edgeDivider.leadingAnchor.constraint(equalTo: leadingAnchor),
                edgeDivider.widthAnchor.constraint(equalToConstant: 1),

                stack.topAnchor.constraint(equalTo: topAnchor),
                stack.bottomAnchor.constraint(equalTo: bottomAnchor),
                stack.leadingAnchor.constraint(equalTo: edgeDivider.trailingAnchor),
                stack.trailingAnchor.constraint(equalTo: trailingAnchor)
            ])
        }
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

            // Vertical bars: each button fills the bar's interior width so
            // labels and close buttons line up flush.
            if stack.orientation == .vertical {
                button.leadingAnchor.constraint(equalTo: stack.leadingAnchor, constant: 8).isActive = true
                button.trailingAnchor.constraint(equalTo: stack.trailingAnchor, constant: -8).isActive = true
            }
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
