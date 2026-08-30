import AppKit

import AgenticToolkitCore
import AgenticToolkitCoreMacOS

/// The sheet behind arrange mode's `Add` button: what to add, and which side of
/// the current pane to put it on.
///
/// The two questions are separate popups rather than one flattened
/// "Add Terminal Below" list because the second answer is the same four options
/// whatever the first one is — a cross product of eight or twelve items is a
/// menu the user has to read instead of a choice they can make.
@MainActor
public final class ComposableTabsAddPaneViewController: NSViewController {

    public typealias Direction = ComposableTabsViewController.Direction

    /// One offerable view: the identifier to add, and what to call it.
    public struct Choice {
        public let viewID: ComposableTabsViewID
        public let displayName: String
        public let symbolName: String?

        public init(viewID: ComposableTabsViewID, displayName: String, symbolName: String?) {
            self.viewID = viewID
            self.displayName = displayName
            self.symbolName = symbolName
        }
    }

    private let choices: [Choice]
    private let onAdd: (ComposableTabsViewID, Direction) -> Void

    private let viewPopUp = NSPopUpButton(frame: .zero, pullsDown: false)
    private let wherePopUp = NSPopUpButton(frame: .zero, pullsDown: false)

    /// Fixed order, so the popup reads the way the pane looks.
    private static let directions: [Direction] = [.left, .right, .above, .below]

    public init(choices: [Choice], onAdd: @escaping (ComposableTabsViewID, Direction) -> Void) {
        self.choices = choices
        self.onAdd = onAdd
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    public required init?(coder: NSCoder) { fatalError() }

    public override func loadView() {
        let container = ThemedBackgroundView(role: .windowBackground)
        container.accessibilityID("composable-tabs.add-pane")

        for (index, choice) in choices.enumerated() {
            viewPopUp.addItem(withTitle: choice.displayName)
            if let symbolName = choice.symbolName {
                viewPopUp.item(at: index)?.image = NSImage(
                    systemSymbolName: symbolName, accessibilityDescription: choice.displayName)
            }
        }
        viewPopUp.accessibilityID("composable-tabs.add-pane.view")

        for direction in Self.directions {
            wherePopUp.addItem(withTitle: direction.placementName)
        }
        // The pane the user is looking at is on the left of a document more
        // often than not, so "to its right" is the least surprising default.
        wherePopUp.selectItem(at: Self.directions.firstIndex(of: .right) ?? 0)
        wherePopUp.accessibilityID("composable-tabs.add-pane.where")

        let cancel = NSButton(title: "Cancel", target: self, action: #selector(cancel(_:)))
        cancel.bezelStyle = .rounded
        cancel.keyEquivalent = "\u{1b}"
        cancel.accessibilityID("composable-tabs.add-pane.cancel")

        let okButton = NSButton(title: "OK", target: self, action: #selector(confirm(_:)))
        okButton.bezelStyle = .rounded
        okButton.keyEquivalent = "\r"
        okButton.isEnabled = !choices.isEmpty
        okButton.accessibilityID("composable-tabs.add-pane.ok")

        let grid = NSGridView(views: [
            [Self.label("Add:"), viewPopUp],
            [Self.label("Where:"), wherePopUp]
        ])
        grid.rowSpacing = 12
        grid.columnSpacing = 8
        grid.column(at: 0).xPlacement = .trailing
        // Centre on centre. A label baseline-aligned against a popup sits high
        // in it, which reads as a row that did not quite line up.
        grid.rowAlignment = .none
        for index in 0..<grid.numberOfRows {
            grid.row(at: index).yPlacement = .center
        }
        grid.translatesAutoresizingMaskIntoConstraints = false

        let buttons = NSStackView(views: [cancel, okButton])
        buttons.orientation = .horizontal
        buttons.spacing = 12
        buttons.translatesAutoresizingMaskIntoConstraints = false

        container.addSubview(grid)
        container.addSubview(buttons)

        NSLayoutConstraint.activate([
            grid.topAnchor.constraint(equalTo: container.topAnchor, constant: 20),
            grid.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: 20),
            container.trailingAnchor.constraint(greaterThanOrEqualTo: grid.trailingAnchor, constant: 20),

            buttons.topAnchor.constraint(equalTo: grid.bottomAnchor, constant: 20),
            container.trailingAnchor.constraint(equalTo: buttons.trailingAnchor, constant: 20),
            buttons.leadingAnchor.constraint(greaterThanOrEqualTo: container.leadingAnchor, constant: 20),
            container.bottomAnchor.constraint(equalTo: buttons.bottomAnchor, constant: 20),

            container.widthAnchor.constraint(greaterThanOrEqualToConstant: 320)
        ])

        self.view = container
    }

    private static func label(_ text: String) -> NSTextField {
        let label = ThemedLabel(string: text, role: .primaryText, textRole: .body)
        label.alignment = .right
        return label
    }

    @objc private func cancel(_ sender: Any?) {
        dismiss(self)
    }

    @objc private func confirm(_ sender: Any?) {
        let viewIndex = viewPopUp.indexOfSelectedItem
        let whereIndex = wherePopUp.indexOfSelectedItem
        guard choices.indices.contains(viewIndex),
              Self.directions.indices.contains(whereIndex) else {
            dismiss(self)
            return
        }
        let choice = choices[viewIndex]
        let direction = Self.directions[whereIndex]
        // Dismiss first: the split re-parents view controllers, and doing that
        // underneath a sheet that is still up leaves the sheet anchored to a
        // window whose content has moved.
        dismiss(self)
        onAdd(choice.viewID, direction)
    }
}
