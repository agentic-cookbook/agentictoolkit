import AppKit
import AgenticToolkitCore
import AgenticToolkitCoreMacOS

public protocol TopicListItemProtocol: Sendable {
    var id: String { get }
    var title: String { get }
    var icon: NSImage? { get }
    var isDisabled: Bool { get }
}

/// One row in a `TopicListViewController`.
public struct TopicListItem: TopicListItemProtocol {
    public let id: String
    public let title: String
    public let icon: NSImage?
    /// Render the row in a muted style (e.g. for "coming soon" placeholders).
    public let isDisabled: Bool

    public init(id: String, title: String, icon: NSImage? = nil, isDisabled: Bool = false) {
        self.id = id
        self.title = title
        self.icon = icon
        self.isDisabled = isDisabled
    }
}

/// A group of items shown under an optional header row.
public struct TopicListSection: Sendable {
    public let title: String?
    public let items: [any TopicListItemProtocol]

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
    public var onSelect: (((any TopicListItemProtocol)?) -> Void)?

    /// Nesting depth of "suppress the selection callback" scopes. While > 0, the
    /// outline's selection-changed delegate is a no-op, so programmatic selection
    /// never echoes back through `onSelect`. A counter (not a one-shot flag) so a
    /// single scope absorbs *both* the notification `reloadData()` posts when it
    /// drops the selection and the one the following re-selection posts — AppKit
    /// delivers these synchronously within the scope.
    private var selectionSuppressionDepth = 0

    /// Runs `body` with `onSelect` suppressed for any selection changes it makes.
    private func suppressingSelectionCallbacks(_ body: () -> Void) {
        selectionSuppressionDepth += 1
        defer { selectionSuppressionDepth -= 1 }
        body()
    }

    private var sections: [TopicListSection] = []
    /// Stable per-section node instances. NSOutlineView identifies items by
    /// reference, so the outline must always be handed the same `TopicListNode`
    /// instance for a given logical row. Rebuilding `rootNodes` on every access
    /// (the previous behaviour) made `row(forItem:)` always return -1, which
    /// in turn made `selectItem(withId:)` silently no-op.
    private var rootNodesCache: [TopicListNode] = []
    // Self-fitting: its single column always fills the (content-sized) sidebar
    // width on every layout pass, so rows never clip their labels regardless of
    // when the enclosing split view settles the sidebar's width.
    private let outlineView = ColumnFillingOutlineView()
    private let scrollView = NSScrollView()

    // Optional title header shown above the list, and an optional client footer
    // (e.g. add/remove/actions) below it. Both collapse to zero height when
    // unset, since they're arranged subviews of `contentStack`.
    private var listTitle: String?
    private let titleLabel = NSTextField(labelWithString: "")
    private let headerView = NSView()
    private let footerContainer = NSView()
    private var footerView: NSView?
    private let contentStack = NSStackView()

    // Keeps the sidebar painted in the active theme's window-background color.
    private var themeObserver: ThemePaletteObserver?

    open override func loadView() {
        let column = NSTableColumn(identifier: NSUserInterfaceItemIdentifier("TopicListColumn"))
        column.title = ""
        // The single column fills the outline's width (see ColumnFillingOutlineView),
        // so rows never clip their labels.
        column.resizingMask = .autoresizingMask
        outlineView.addTableColumn(column)
        outlineView.outlineTableColumn = column
        outlineView.headerView = nil
        // Use .automatic (not .sourceList) so no internal NSVisualEffectView
        // forces a dark sidebar material regardless of NSApp.appearance.
        outlineView.style = .automatic
        outlineView.rowSizeStyle = .default
        // Flat list (no disclosure triangles) — reclaim the per-level indent so
        // the row's own leading inset is the only left margin, keeping the
        // content-sized width honest.
        outlineView.indentationPerLevel = 0
        outlineView.columnAutoresizingStyle = .uniformColumnAutoresizingStyle
        outlineView.dataSource = self
        outlineView.delegate = self

        scrollView.documentView = outlineView
        scrollView.hasVerticalScroller = true
        // Overlay + autohide: the scroller floats over the content and only
        // appears while scrolling *and* only when the list actually overflows, so
        // a short topic list shows no scroller gutter.
        scrollView.scrollerStyle = .overlay
        scrollView.autohidesScrollers = true
        scrollView.drawsBackground = true
        scrollView.translatesAutoresizingMaskIntoConstraints = false

        configureHeader()
        applyFooterView()

        contentStack.orientation = .vertical
        contentStack.alignment = .leading
        contentStack.spacing = 0
        contentStack.translatesAutoresizingMaskIntoConstraints = false
        contentStack.addArrangedSubview(headerView)
        contentStack.addArrangedSubview(scrollView)
        contentStack.addArrangedSubview(footerContainer)
        for sub in [headerView, scrollView, footerContainer] {
            sub.widthAnchor.constraint(equalTo: contentStack.widthAnchor).isActive = true
        }
        // The list soaks up the free vertical space; the header/footer keep their
        // natural height (a hidden arranged subview collapses to zero in the stack).
        scrollView.setContentHuggingPriority(.defaultLow, for: .vertical)
        headerView.setContentHuggingPriority(.required, for: .vertical)
        footerContainer.setContentHuggingPriority(.required, for: .vertical)

        self.view = contentStack

        themeObserver = ThemePaletteObserver { [weak self] palette in
            self?.applyTheme(palette)
        }
    }

    private func applyTheme(_ palette: SemanticPalette) {
        let background = palette.windowBackgroundColor
        contentStack.wantsLayer = true
        contentStack.layer?.backgroundColor = background.cgColor
        headerView.wantsLayer = true
        headerView.layer?.backgroundColor = background.cgColor
        footerContainer.wantsLayer = true
        footerContainer.layer?.backgroundColor = background.cgColor
        titleLabel.font = palette.font(.button)
        titleLabel.textColor = palette.secondaryTextColor
        scrollView.backgroundColor = background
        outlineView.backgroundColor = background

        // reloadData() repaints the rows' themed text, but it can also drop the
        // outline's selection — and a theme change is exactly what triggers this,
        // so without restoring it the highlighted row loses its highlight on every
        // theme switch. Suppress across the whole reload+restore: reloadData()'s
        // own selection-drop would otherwise fire a spurious onSelect(nil) (which
        // clears the detail pane), and the restore fires another callback — a
        // scope absorbs both.
        let selection = outlineView.selectedRowIndexes
        suppressingSelectionCallbacks {
            outlineView.reloadData()
            if !selection.isEmpty, outlineView.selectedRowIndexes != selection {
                outlineView.selectRowIndexes(selection, byExtendingSelection: false)
            }
        }
    }

    // MARK: - Title header + footer

    /// Sets the sidebar's title, shown as a header above the list. A nil or empty
    /// title hides the header entirely.
    open func setTitle(_ title: String?) {
        listTitle = title
        if isViewLoaded { updateHeaderVisibility() }
    }

    /// Installs (or, with nil, clears) a client footer pinned below the list —
    /// e.g. an add / remove / actions bar. The footer spans the sidebar width.
    open func setFooterView(_ view: NSView?) {
        footerView = view
        if isViewLoaded { applyFooterView() }
    }

    private func configureHeader() {
        titleLabel.lineBreakMode = .byTruncatingTail
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        headerView.translatesAutoresizingMaskIntoConstraints = false
        headerView.addSubview(titleLabel)
        NSLayoutConstraint.activate([
            titleLabel.leadingAnchor.constraint(equalTo: headerView.leadingAnchor, constant: 14),
            titleLabel.trailingAnchor.constraint(lessThanOrEqualTo: headerView.trailingAnchor, constant: -8),
            titleLabel.topAnchor.constraint(equalTo: headerView.topAnchor, constant: 10),
            titleLabel.bottomAnchor.constraint(equalTo: headerView.bottomAnchor, constant: -6)
        ])
        updateHeaderVisibility()
    }

    private func updateHeaderVisibility() {
        let text = listTitle?.trimmingCharacters(in: .whitespaces) ?? ""
        titleLabel.stringValue = text
        headerView.isHidden = text.isEmpty
    }

    private func applyFooterView() {
        footerContainer.translatesAutoresizingMaskIntoConstraints = false
        footerContainer.subviews.forEach { $0.removeFromSuperview() }
        guard let footerView else {
            footerContainer.isHidden = true
            return
        }
        footerContainer.isHidden = false
        footerView.translatesAutoresizingMaskIntoConstraints = false
        footerContainer.addSubview(footerView)
        NSLayoutConstraint.activate([
            footerView.leadingAnchor.constraint(equalTo: footerContainer.leadingAnchor),
            footerView.trailingAnchor.constraint(equalTo: footerContainer.trailingAnchor),
            footerView.topAnchor.constraint(equalTo: footerContainer.topAnchor),
            footerView.bottomAnchor.constraint(equalTo: footerContainer.bottomAnchor)
        ])
    }

    /// Populate the list as a flat sequence with no section headers.
    open func setItems(_ items: [TopicListItem]) {
        setSections([TopicListSection(title: nil, items: items)])
    }

    /// Populate the list with grouped sections. Sections whose `title` is nil
    /// render their items without a header row.
    open func setSections(_ sections: [TopicListSection]) {
        self.sections = sections
        self.rootNodesCache = Self.buildRootNodes(from: sections)
        outlineView.reloadData()
        outlineView.expandItem(nil, expandChildren: true)
    }

    /// The width needed to fully show the widest row (icon + label) without
    /// truncation, so the sidebar can be sized to its content instead of an
    /// arbitrary draggable width. Mirrors the cell layout in `makeItemCell` /
    /// `makeHeaderCell` (leading inset + icon + gap + text + trailing inset) plus
    /// an allowance for the outline's internal margins and the vertical scroller.
    open func preferredWidth() -> CGFloat {
        var widest: CGFloat = 0
        // The title header participates so a long panel name never truncates.
        if let listTitle, !listTitle.isEmpty {
            widest = max(widest, CellMetrics.titleLeadingInset
                + ceil(listTitle.renderedWidth(usingFont: CellMetrics.titleFont)))
        }
        for section in sections {
            if let title = section.title, !title.isEmpty {
                widest = max(widest, CellMetrics.headerLeadingInset
                    + ceil(title.renderedWidth(usingFont: CellMetrics.headerFont)))
            }
            for item in section.items {
                widest = max(widest, CellMetrics.itemChromeWidth
                    + ceil(item.title.renderedWidth(usingFont: CellMetrics.itemFont)))
            }
        }
        var width = widest + Self.outlineChromePadding
        // A footer bar (add/remove/actions) shouldn't be clipped either.
        if let footerView {
            width = max(width, footerView.fittingSize.width)
        }
        return width
    }

    /// The one source of truth for the row layout, shared by `preferredWidth`
    /// (which measures it) and `makeItemCell`/`makeHeaderCell` (which build it),
    /// so the two can never drift and silently re-clip labels.
    @MainActor
    fileprivate enum CellMetrics {
        // The theme owns the fonts, so these read the live palette rather than
        // baking in a size — `preferredWidth()` measures with the same font the
        // cells are about to be drawn in, whichever theme is active.
        static var itemFont: NSFont { ThemePaletteObserver.currentPalette.font(.body) }
        static var headerFont: NSFont { ThemePaletteObserver.currentPalette.font(.caption) }
        static var titleFont: NSFont { ThemePaletteObserver.currentPalette.font(.button) }
        static let titleLeadingInset: CGFloat = 14
        static let iconLeadingInset: CGFloat = 4
        static let iconSize: CGFloat = 16
        static let iconToTextGap: CGFloat = 6
        static let textTrailingInset: CGFloat = 4
        static let headerLeadingInset: CGFloat = 2
        /// Everything around an item row's text: leading inset + icon + gap + trailing.
        static var itemChromeWidth: CGFloat {
            iconLeadingInset + iconSize + iconToTextGap + textTrailingInset
        }
    }

    // Allowance beyond a row's own cell content: the source-list sidebar's
    // built-in leading inset, the vertical-scroller gutter, and a trailing margin.
    // These are AppKit implementation details with no public metric, so they're
    // empirical — named separately to document what the total (64) is paying for.
    private static let sourceListLeadingInset: CGFloat = 30
    private static let scrollerGutter: CGFloat = 16
    private static let trailingMargin: CGFloat = 18
    private static var outlineChromePadding: CGFloat {
        sourceListLeadingInset + scrollerGutter + trailingMargin
    }

    /// Selects the row matching `id` without firing `onSelect`.
    /// No-op if the id isn't present.
    open func selectItem(withId id: String) {
        guard let node = rootNodesCache.first(where: { node in
            if case .item(let item) = node.kind, item.id == id { return true }
            return false
        }) else { return }
        let row = outlineView.row(forItem: node)
        // Bail if the row is already selected: selectRowIndexes would be a no-op
        // that fires no callback, so there'd be nothing to suppress anyway.
        guard row >= 0, outlineView.selectedRow != row else { return }
        suppressingSelectionCallbacks {
            outlineView.selectRowIndexes(IndexSet(integer: row), byExtendingSelection: false)
        }
    }

    private static func buildRootNodes(from sections: [TopicListSection]) -> [TopicListNode] {
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

    private func findItem(withId id: String) -> TopicListItemProtocol? {
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

extension TopicListViewController {
    /// An outline view whose single column fills the available width on every
    /// layout pass, so rows never clip their labels. `sizeLastColumnToFit()`
    /// after `super.layout()` is the safe primitive here — setting `column.width`
    /// directly from `layout()` re-enters `NSTableView.tile`/`setFrameSize` and
    /// throws.
    fileprivate final class ColumnFillingOutlineView: NSOutlineView {
        override func layout() {
            super.layout()
            sizeLastColumnToFit()
        }
    }
}

private final class TopicListNode: NSObject {
    enum Kind {
        case header(String)
        case item(TopicListItemProtocol)
    }
    let kind: Kind
    init(kind: Kind) { self.kind = kind }

    static func header(_ title: String) -> TopicListNode { .init(kind: .header(title)) }
    static func item(_ item: TopicListItemProtocol) -> TopicListNode { .init(kind: .item(item)) }
}

extension TopicListViewController {
    fileprivate var rootNodes: [TopicListNode] { rootNodesCache }
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
        let palette = ThemePaletteObserver.currentPalette

        switch node.kind {
        case .header(let title):
            let id = NSUserInterfaceItemIdentifier("TopicListHeader")
            let cell = outlineView.makeView(withIdentifier: id, owner: nil) as? NSTableCellView
                ?? Self.makeHeaderCell(identifier: id)
            cell.textField?.stringValue = title
            cell.textField?.font = CellMetrics.headerFont
            cell.textField?.textColor = palette.secondaryTextColor
            return cell

        case .item(let item):
            let id = NSUserInterfaceItemIdentifier("TopicListItem")
            let cell = outlineView.makeView(withIdentifier: id, owner: nil) as? NSTableCellView
                ?? Self.makeItemCell(identifier: id)
            cell.textField?.stringValue = item.title
            // Cells are pooled, so the font is reapplied here alongside the color
            // rather than at creation — a font baked in stays stale after a swap.
            cell.textField?.font = CellMetrics.itemFont
            cell.textField?.textColor = item.isDisabled ? palette.tertiaryTextColor : palette.primaryTextColor
            cell.textField?.alphaValue = 1.0
            cell.imageView?.image = item.icon
            cell.imageView?.contentTintColor = item.isDisabled
                ? palette.tertiaryTextColor
                : palette.accentColor
            return cell
        }
    }

    public func outlineView(
        _ outlineView: NSOutlineView,
        rowViewForItem item: Any
    ) -> NSTableRowView? {
        // Self-themed: it observes the palette and repaints on theme change.
        return ThemedTableRowView(frame: .zero)
    }

    public func outlineViewSelectionDidChange(_ notification: Notification) {
        if selectionSuppressionDepth > 0 { return }
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
        textField.translatesAutoresizingMaskIntoConstraints = false
        cell.addSubview(textField)
        cell.textField = textField
        NSLayoutConstraint.activate([
            textField.leadingAnchor.constraint(
                equalTo: cell.leadingAnchor, constant: CellMetrics.headerLeadingInset),
            textField.centerYAnchor.constraint(equalTo: cell.centerYAnchor)
        ])
        return cell
    }

    private static func makeItemCell(identifier: NSUserInterfaceItemIdentifier) -> NSTableCellView {
        let cell = NSTableCellView()
        cell.identifier = identifier

        let imageView = NSImageView()
        imageView.translatesAutoresizingMaskIntoConstraints = false

        let textField = NSTextField(labelWithString: "")
        textField.lineBreakMode = .byTruncatingTail
        textField.translatesAutoresizingMaskIntoConstraints = false

        cell.addSubview(imageView)
        cell.addSubview(textField)
        cell.imageView = imageView
        cell.textField = textField

        NSLayoutConstraint.activate([
            imageView.leadingAnchor.constraint(
                equalTo: cell.leadingAnchor, constant: CellMetrics.iconLeadingInset),
            imageView.centerYAnchor.constraint(equalTo: cell.centerYAnchor),
            imageView.widthAnchor.constraint(equalToConstant: CellMetrics.iconSize),
            imageView.heightAnchor.constraint(equalToConstant: CellMetrics.iconSize),

            textField.leadingAnchor.constraint(
                equalTo: imageView.trailingAnchor, constant: CellMetrics.iconToTextGap),
            textField.trailingAnchor.constraint(
                lessThanOrEqualTo: cell.trailingAnchor, constant: -CellMetrics.textTrailingInset),
            textField.centerYAnchor.constraint(equalTo: cell.centerYAnchor)
        ])

        return cell
    }
}
