import AppKit

import AgenticToolkitCore
import AgenticToolkitCoreMacOS

/// What a pane looks like while the user is arranging rather than working: the
/// content dimmed behind a scrim, and one small toolbar in the middle of it.
///
/// The scrim is a real view rather than an alpha on the content because it also
/// has to *swallow* the clicks — a terminal that kept taking keystrokes behind
/// the arrange toolbar would be a pane you can rearrange and type into at the
/// same time. It stays a subview of the pane's backdrop, so a click on it still
/// walks up to `ComposableTabsPaneBackgroundView` and selects the pane, which is
/// how a dimmed pane can still be the one you are moving.
@MainActor
final class ComposableTabsArrangeOverlayView: NSView {

    typealias Direction = ComposableTabsViewController.Direction

    var onAdd: (() -> Void)?
    var onRemove: (() -> Void)?
    var onMove: ((Direction) -> Void)?

    /// Re-read on every `refreshAvailability()`; the tree changes under this
    /// view every time any pane moves.
    var canAdd: () -> Bool = { true }
    var canRemove: () -> Bool = { true }
    var availableDirections: () -> Set<Direction> = { [] }

    private let toolbar = NSView()
    private let addButton: NSButton
    private let removeButton: NSButton
    private let moveButton = NSPopUpButton(frame: .zero, pullsDown: true)

    override init(frame frameRect: NSRect) {
        addButton = Self.makeButton(title: "Add", symbolName: "plus")
        removeButton = Self.makeButton(title: "Remove", symbolName: "minus")
        super.init(frame: frameRect)
        wantsLayer = true
        accessibilityID("composable-tabs.arrange.scrim")

        addButton.target = self
        addButton.action = #selector(addTapped(_:))
        addButton.accessibilityID("composable-tabs.arrange.add")

        removeButton.target = self
        removeButton.action = #selector(removeTapped(_:))
        removeButton.accessibilityID("composable-tabs.arrange.remove")

        moveButton.bezelStyle = .rounded
        moveButton.addItem(withTitle: "Move")
        moveButton.menu?.autoenablesItems = false
        moveButton.accessibilityID("composable-tabs.arrange.move")

        buildToolbar()
        observeTheme { view, palette in view.applyPalette(palette) }
        refreshAvailability()
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

    private static func makeButton(title: String, symbolName: String) -> NSButton {
        let button = NSButton(title: title, target: nil, action: nil)
        button.bezelStyle = .rounded
        button.image = NSImage(systemSymbolName: symbolName, accessibilityDescription: title)
        button.imagePosition = .imageLeading
        return button
    }

    private func buildToolbar() {
        toolbar.wantsLayer = true
        toolbar.layer?.cornerRadius = 8
        toolbar.layer?.borderWidth = 1
        toolbar.translatesAutoresizingMaskIntoConstraints = false
        addSubview(toolbar)

        let stack = NSStackView(views: [addButton, removeButton, moveButton])
        stack.orientation = .horizontal
        stack.spacing = 8
        stack.translatesAutoresizingMaskIntoConstraints = false
        toolbar.addSubview(stack)

        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: toolbar.topAnchor, constant: 8),
            stack.leadingAnchor.constraint(equalTo: toolbar.leadingAnchor, constant: 8),
            toolbar.trailingAnchor.constraint(equalTo: stack.trailingAnchor, constant: 8),
            toolbar.bottomAnchor.constraint(equalTo: stack.bottomAnchor, constant: 8),

            // Centred, and allowed to overhang a pane too narrow to hold it —
            // the alternative is forcing the split wider than the user sized it.
            toolbar.centerXAnchor.constraint(equalTo: centerXAnchor),
            toolbar.centerYAnchor.constraint(equalTo: centerYAnchor)
        ])
    }

    private func applyPalette(_ palette: SemanticPalette) {
        // Dimming toward the window background rather than toward black keeps
        // a light theme light — the content reads as *behind* something, not
        // as switched off.
        layer?.backgroundColor = palette.nsColor(.windowBackground).withAlphaComponent(0.72).cgColor
        toolbar.layer?.backgroundColor = palette.nsColor(.elevatedSurface).cgColor
        toolbar.layer?.borderColor = palette.nsColor(.border).cgColor
    }

    /// Re-reads what this pane may do. Called whenever the tree changes, since
    /// the last remaining pane cannot be removed and a pane at the top of the
    /// window has no `Up`.
    func refreshAvailability() {
        addButton.isEnabled = canAdd()
        removeButton.isEnabled = canRemove()

        let available = availableDirections()
        let title = moveButton.menu?.items.first
        moveButton.menu?.removeAllItems()
        if let title { moveButton.menu?.addItem(title) }

        for direction in Direction.allCases {
            let item = NSMenuItem(
                title: direction.movementName,
                action: #selector(moveSelected(_:)),
                keyEquivalent: ""
            )
            item.target = self
            item.representedObject = DirectionBox(direction)
            item.isEnabled = available.contains(direction)
            item.image = NSImage(
                systemSymbolName: direction.arrowSymbolName,
                accessibilityDescription: direction.movementName)
            item.accessibilityID("composable-tabs.arrange.move.\(direction.movementName.lowercased())")
            moveButton.menu?.addItem(item)
        }
        moveButton.isEnabled = !available.isEmpty
    }

    /// `representedObject` is `Any?`, and a bare enum bridges to `NSNull` under
    /// Swift 6's stricter object-conversion rules; boxing keeps it a real
    /// reference.
    private final class DirectionBox: NSObject {
        let direction: Direction
        init(_ direction: Direction) { self.direction = direction }
    }

    @objc private func addTapped(_ sender: Any?) { onAdd?() }
    @objc private func removeTapped(_ sender: Any?) { onRemove?() }

    @objc private func moveSelected(_ sender: NSMenuItem) {
        guard let box = sender.representedObject as? DirectionBox else { return }
        onMove?(box.direction)
    }
}
