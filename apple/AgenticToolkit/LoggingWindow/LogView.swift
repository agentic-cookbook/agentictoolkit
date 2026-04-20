import AppKit

/// Scrolling table-view of ``LogLine``s driven by a ``LogProvider``.
///
/// Renders columns from the provider, observes mutations via the
/// provider's delegate slot, and dispatches row clicks through the
/// hooks on the clicked column. Deliberately does not ship a toolbar,
/// filter UI, or status indicator — those are caller concerns; compose
/// them around the view and pass the result into ``LogWindowController``
/// (or embed elsewhere).
@MainActor
public final class LogView: NSView, NSTableViewDataSource, NSTableViewDelegate, LogProviderDelegate {
    public let provider: any LogProvider

    /// When true, newly-appended rows scroll into view if the user is
    /// already pinned to the bottom. Toggling this off is how a caller
    /// builds a "pause auto-scroll" control.
    public var followTail: Bool = true

    private let tableView = NSTableView()
    private let scrollView = NSScrollView()
    private var columnIDByIndex: [Int: String] = [:]

    public init(provider: any LogProvider) {
        self.provider = provider
        super.init(frame: .zero)
        configureScrollView()
        configureTable()
        provider.delegate = self
        tableView.reloadData()
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) unavailable — use init(provider:)") }

    /// Exposed so tests (and callers doing programmatic scrolling)
    /// can re-assert tail-follow after a filter change.
    public func scrollToEnd() {
        let last = tableView.numberOfRows - 1
        guard last >= 0 else { return }
        tableView.scrollRowToVisible(last)
    }

    /// Exposed for tests; also useful if a caller wants to force a
    /// redraw (e.g. after mutating column metadata).
    public func reload() {
        tableView.reloadData()
    }

    // MARK: - Setup

    private func configureScrollView() {
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        scrollView.hasVerticalScroller = true
        scrollView.hasHorizontalScroller = false
        scrollView.autohidesScrollers = true
        scrollView.documentView = tableView
        addSubview(scrollView)
        NSLayoutConstraint.activate([
            scrollView.topAnchor.constraint(equalTo: topAnchor),
            scrollView.leadingAnchor.constraint(equalTo: leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: trailingAnchor),
            scrollView.bottomAnchor.constraint(equalTo: bottomAnchor),
        ])
    }

    private func configureTable() {
        tableView.dataSource = self
        tableView.delegate = self
        tableView.usesAlternatingRowBackgroundColors = true
        tableView.allowsColumnResizing = true
        tableView.columnAutoresizingStyle = .uniformColumnAutoresizingStyle
        tableView.rowSizeStyle = .default
        tableView.target = self
        tableView.action = #selector(tableClicked)
        tableView.doubleAction = #selector(tableDoubleClicked)

        for (index, column) in provider.columns.enumerated() {
            let tc = NSTableColumn(identifier: NSUserInterfaceItemIdentifier(column.id))
            tc.title = column.title
            tc.width = column.defaultWidth
            tc.minWidth = column.minWidth
            tc.maxWidth = column.maxWidth
            tableView.addTableColumn(tc)
            columnIDByIndex[index] = column.id
        }
    }

    // MARK: - Click dispatch

    /// The kind of click routed through ``dispatchClick(columnIndex:row:kind:)``.
    /// Public so tests can drive the same entry point AppKit uses.
    public enum ClickKind { case single, double }

    @objc private func tableClicked(_ sender: NSTableView) {
        dispatchClick(columnIndex: sender.clickedColumn, row: sender.clickedRow, kind: .single)
    }

    @objc private func tableDoubleClicked(_ sender: NSTableView) {
        dispatchClick(columnIndex: sender.clickedColumn, row: sender.clickedRow, kind: .double)
    }

    /// Dispatch a click to the hook on the matching column. Exposed
    /// for tests — production callers reach this via the selector
    /// actions above.
    public func dispatchClick(columnIndex: Int, row: Int, kind: ClickKind) {
        guard columnIndex >= 0,
              row >= 0,
              row < provider.lines.count else { return }
        guard let columnID = columnIDByIndex[columnIndex] else { return }
        guard let column = provider.columns.first(where: { $0.id == columnID }) else { return }
        let line = provider.lines[row]
        switch kind {
        case .single: column.onClick?(line)
        case .double: column.onDoubleClick?(line)
        }
    }

    // MARK: - LogProviderDelegate

    public func logProvider(_ provider: any LogProvider, didChange change: LogChange) {
        let shouldFollow: Bool
        switch change {
        case .appended:
            shouldFollow = followTail && isScrolledToBottom()
        case .replaced:
            shouldFollow = followTail
        case .cleared:
            shouldFollow = false
        }
        tableView.reloadData()
        if shouldFollow { scrollToEnd() }
    }

    private func isScrolledToBottom() -> Bool {
        guard tableView.numberOfRows > 0 else { return true }
        let visible = scrollView.documentVisibleRect
        let docHeight = scrollView.documentView?.bounds.height ?? 0
        return visible.maxY >= docHeight - 2
    }

    // MARK: - NSTableViewDataSource

    public func numberOfRows(in tableView: NSTableView) -> Int {
        provider.lines.count
    }

    // MARK: - NSTableViewDelegate

    public func tableView(_ tableView: NSTableView, viewFor tableColumn: NSTableColumn?, row: Int) -> NSView? {
        guard let tableColumn else { return nil }
        guard row < provider.lines.count else { return nil }
        let columnID = tableColumn.identifier.rawValue
        let cell = makeCell(tableView: tableView, columnID: columnID)
        let line = provider.lines[row]

        if let value = line.values[columnID] {
            switch value {
            case .plain(let s):
                cell.stringValue = s
            case .attributed(let a):
                cell.attributedStringValue = a
            }
        } else {
            cell.stringValue = ""
        }

        if let column = provider.columns.first(where: { $0.id == columnID }) {
            cell.alignment = column.alignment
        }
        cell.lineBreakMode = .byTruncatingTail
        cell.toolTip = cell.stringValue
        return cell
    }

    private func makeCell(tableView: NSTableView, columnID: String) -> NSTextField {
        let identifier = NSUserInterfaceItemIdentifier("cell.\(columnID)")
        if let existing = tableView.makeView(withIdentifier: identifier, owner: nil) as? NSTextField {
            return existing
        }
        let field = NSTextField(labelWithString: "")
        field.identifier = identifier
        field.isBordered = false
        field.drawsBackground = false
        field.isEditable = false
        field.isSelectable = false
        return field
    }
}
