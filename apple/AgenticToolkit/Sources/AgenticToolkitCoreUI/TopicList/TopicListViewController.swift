import AppKit

/// One row in a `TopicListViewController`.
public struct TopicListItem: Sendable {
    public let id: String
    public let title: String
    public let icon: NSImage?
    /// Render the row in a muted style (e.g. for "coming soon" placeholders).
    public let isDimmed: Bool

    public init(id: String, title: String, icon: NSImage? = nil, isDimmed: Bool = false) {
        self.id = id
        self.title = title
        self.icon = icon
        self.isDimmed = isDimmed
    }
}

/// A group of items shown under an optional header row.
public struct TopicListSection: Sendable {
    public let title: String?
    public let items: [TopicListItem]

    public init(title: String?, items: [TopicListItem]) {
        self.title = title
        self.items = items
    }
}

/// Sectioned source-list sidebar control.
///
/// A reusable AppKit list with optional section headers, SF-Symbol-friendly
/// icons, and closure-based selection. Knows nothing about settings, the
/// host app, or any specific data domain — supply items via `setItems` (flat)
/// or `setSections` (grouped) and observe selection via `onSelect`.
@MainActor
open class TopicListViewController: NSViewController {

    /// Fired when the user changes the selection. Nil when nothing is selected.
    public var onSelect: ((TopicListItem?) -> Void)?

    /// Suppresses the next `onSelect` callback. Used by `selectItem(withId:)`
    /// so programmatic selection doesn't echo back to callers that just told
    /// us what to select.
    private var suppressNextSelectionCallback = false

    private var sections: [TopicListSection] = []
    private let outlineView = NSOutlineView()
    private let scrollView = NSScrollView()

    open override func loadView() {
        let column = NSTableColumn(identifier: NSUserInterfaceItemIdentifier("TopicListColumn"))
        column.title = ""
        outlineView.addTableColumn(column)
        outlineView.outlineTableColumn = column
        outlineView.headerView = nil
        outlineView.style = .sourceList
        outlineView.rowSizeStyle = .default
        outlineView.dataSource = self
        outlineView.delegate = self

        scrollView.documentView = outlineView
        scrollView.hasVerticalScroller = true
        scrollView.drawsBackground = false
        self.view = scrollView
    }

    /// Populate the list as a flat sequence with no section headers.
    open func setItems(_ items: [TopicListItem]) {
        setSections([TopicListSection(title: nil, items: items)])
    }

    /// Populate the list with grouped sections. Sections whose `title` is nil
    /// render their items without a header row.
    open func setSections(_ sections: [TopicListSection]) {
        self.sections = sections
        outlineView.reloadData()
        outlineView.expandItem(nil, expandChildren: true)
    }

    /// Selects the row matching `id` without firing `onSelect`.
    /// No-op if the id isn't present.
    open func selectItem(withId id: String) {
        guard let item = findItem(withId: id) else { return }
        let row = outlineView.row(forItem: TopicListNode.item(item))
        guard row >= 0 else { return }
        suppressNextSelectionCallback = true
        outlineView.selectRowIndexes(IndexSet(integer: row), byExtendingSelection: false)
    }

    private func findItem(withId id: String) -> TopicListItem? {
        for section in sections {
            if let match = section.items.first(where: { $0.id == id }) {
                return match
            }
        }
        return nil
    }
}

// MARK: - Internal node model
//
// NSOutlineView identifies items by reference. Wrapping the Sendable value
// types in a class lets us return the same instance for the same logical
// row across reloads, which keeps NSOutlineView's selection bookkeeping
// stable.

private final class TopicListNode: NSObject {
    enum Kind {
        case header(String)
        case item(TopicListItem)
    }
    let kind: Kind
    init(kind: Kind) { self.kind = kind }

    static func header(_ title: String) -> TopicListNode { .init(kind: .header(title)) }
    static func item(_ item: TopicListItem) -> TopicListNode { .init(kind: .item(item)) }
}

extension TopicListViewController {
    fileprivate var rootNodes: [TopicListNode] {
        var nodes: [TopicListNode] = []
        for section in sections {
            if let title = section.title, !title.isEmpty {
                nodes.append(.header(title))
            }
            for item in section.items {
                nodes.append(.item(item))
            }
        }
        return nodes
    }
}

// MARK: - NSOutlineViewDataSource

extension TopicListViewController: NSOutlineViewDataSource {

    public func outlineView(_ outlineView: NSOutlineView, numberOfChildrenOfItem item: Any?) -> Int {
        item == nil ? rootNodes.count : 0
    }

    public func outlineView(_ outlineView: NSOutlineView, child index: Int, ofItem item: Any?) -> Any {
        rootNodes[index]
    }

    public func outlineView(_ outlineView: NSOutlineView, isItemExpandable item: Any) -> Bool {
        false
    }
}

// MARK: - NSOutlineViewDelegate

extension TopicListViewController: NSOutlineViewDelegate {

    public func outlineView(_ outlineView: NSOutlineView, isGroupItem item: Any) -> Bool {
        guard let node = item as? TopicListNode, case .header = node.kind else { return false }
        return true
    }

    public func outlineView(_ outlineView: NSOutlineView, shouldSelectItem item: Any) -> Bool {
        guard let node = item as? TopicListNode, case .item = node.kind else { return false }
        return true
    }

    public func outlineView(_ outlineView: NSOutlineView, viewFor tableColumn: NSTableColumn?, item: Any) -> NSView? {
        guard let node = item as? TopicListNode else { return nil }

        switch node.kind {
        case .header(let title):
            let id = NSUserInterfaceItemIdentifier("TopicListHeader")
            let cell = outlineView.makeView(withIdentifier: id, owner: nil) as? NSTableCellView
                ?? Self.makeHeaderCell(identifier: id)
            cell.textField?.stringValue = title
            return cell

        case .item(let item):
            let id = NSUserInterfaceItemIdentifier("TopicListItem")
            let cell = outlineView.makeView(withIdentifier: id, owner: nil) as? NSTableCellView
                ?? Self.makeItemCell(identifier: id)
            cell.textField?.stringValue = item.title
            cell.textField?.alphaValue = item.isDimmed ? 0.5 : 1.0
            cell.imageView?.image = item.icon
            cell.imageView?.contentTintColor = item.isDimmed ? .tertiaryLabelColor : .controlAccentColor
            return cell
        }
    }

    public func outlineViewSelectionDidChange(_ notification: Notification) {
        if suppressNextSelectionCallback {
            suppressNextSelectionCallback = false
            return
        }
        let row = outlineView.selectedRow
        guard row >= 0,
              let node = outlineView.item(atRow: row) as? TopicListNode,
              case .item(let item) = node.kind
        else {
            onSelect?(nil)
            return
        }
        onSelect?(item)
    }

    public func outlineView(_ outlineView: NSOutlineView, shouldShowOutlineCellForItem item: Any) -> Bool {
        false
    }

    // MARK: - Cell factories

    private static func makeHeaderCell(identifier: NSUserInterfaceItemIdentifier) -> NSTableCellView {
        let cell = NSTableCellView()
        cell.identifier = identifier
        let textField = NSTextField(labelWithString: "")
        textField.font = .systemFont(ofSize: 11, weight: .semibold)
        textField.textColor = .secondaryLabelColor
        textField.translatesAutoresizingMaskIntoConstraints = false
        cell.addSubview(textField)
        cell.textField = textField
        NSLayoutConstraint.activate([
            textField.leadingAnchor.constraint(equalTo: cell.leadingAnchor, constant: 2),
            textField.centerYAnchor.constraint(equalTo: cell.centerYAnchor),
        ])
        return cell
    }

    private static func makeItemCell(identifier: NSUserInterfaceItemIdentifier) -> NSTableCellView {
        let cell = NSTableCellView()
        cell.identifier = identifier

        let imageView = NSImageView()
        imageView.translatesAutoresizingMaskIntoConstraints = false

        let textField = NSTextField(labelWithString: "")
        textField.font = .systemFont(ofSize: 13)
        textField.lineBreakMode = .byTruncatingTail
        textField.translatesAutoresizingMaskIntoConstraints = false

        cell.addSubview(imageView)
        cell.addSubview(textField)
        cell.imageView = imageView
        cell.textField = textField

        NSLayoutConstraint.activate([
            imageView.leadingAnchor.constraint(equalTo: cell.leadingAnchor, constant: 4),
            imageView.centerYAnchor.constraint(equalTo: cell.centerYAnchor),
            imageView.widthAnchor.constraint(equalToConstant: 16),
            imageView.heightAnchor.constraint(equalToConstant: 16),

            textField.leadingAnchor.constraint(equalTo: imageView.trailingAnchor, constant: 6),
            textField.trailingAnchor.constraint(lessThanOrEqualTo: cell.trailingAnchor, constant: -4),
            textField.centerYAnchor.constraint(equalTo: cell.centerYAnchor),
        ])

        return cell
    }
}
