import AppKit

/// A sidebar + detail split view that hosts an array of ``SettingsPane`` items.
///
/// The sidebar shows each pane's title and SF Symbol icon. Selecting a row
/// swaps the detail area to that pane's view. Detail views are created lazily
/// on first selection and cached thereafter.
@MainActor
public final class SettingsSplitView: NSView, NSTableViewDataSource, NSTableViewDelegate, NSSplitViewDelegate {

    // MARK: - Properties

    private let panes: [SettingsPane]
    private var cachedViews: [Int: NSView] = [:]
    private var selectedIndex: Int = 0

    private let splitView = NSSplitView()
    private let sidebarTableView = NSTableView()
    private let detailContainer: NSScrollView = {
        let sv = NSScrollView()
        sv.contentView = FlippedClipView()
        return sv
    }()
    private var currentDetailView: NSView?
    private var needsInitialDividerPosition = true

    private static let sidebarWidth: CGFloat = 180
    private static let detailPadding: CGFloat = 20

    // MARK: - Initialization

    /// Creates a settings split view with the given panes.
    /// - Parameter panes: The panes to display. Must not be empty.
    public init(panes: [SettingsPane]) {
        precondition(!panes.isEmpty, "SettingsSplitView requires at least one pane")
        self.panes = panes
        super.init(frame: .zero)
        setupViews()
        selectPane(at: 0)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

    // MARK: - Layout

    public override func layout() {
        super.layout()
        if needsInitialDividerPosition && bounds.width > 0 {
            needsInitialDividerPosition = false
            splitView.setPosition(Self.sidebarWidth, ofDividerAt: 0)
        }
    }

    // MARK: - Setup

    private func setupViews() {
        let column = NSTableColumn(identifier: NSUserInterfaceItemIdentifier("settingsPane"))
        column.title = ""
        sidebarTableView.addTableColumn(column)
        sidebarTableView.headerView = nil
        sidebarTableView.dataSource = self
        sidebarTableView.delegate = self
        sidebarTableView.rowHeight = 28
        sidebarTableView.style = .sourceList
        sidebarTableView.selectionHighlightStyle = .sourceList

        let sidebarScroll = NSScrollView()
        sidebarScroll.documentView = sidebarTableView
        sidebarScroll.hasVerticalScroller = true
        sidebarScroll.drawsBackground = false
        sidebarScroll.translatesAutoresizingMaskIntoConstraints = false

        detailContainer.hasVerticalScroller = true
        detailContainer.drawsBackground = false
        detailContainer.translatesAutoresizingMaskIntoConstraints = false

        splitView.isVertical = true
        splitView.dividerStyle = .thin
        splitView.delegate = self
        splitView.translatesAutoresizingMaskIntoConstraints = false
        splitView.addArrangedSubview(sidebarScroll)
        splitView.addArrangedSubview(detailContainer)
        splitView.setHoldingPriority(.required, forSubviewAt: 0)
        splitView.setHoldingPriority(.defaultLow, forSubviewAt: 1)

        addSubview(splitView)
        NSLayoutConstraint.activate([
            splitView.topAnchor.constraint(equalTo: topAnchor),
            splitView.leadingAnchor.constraint(equalTo: leadingAnchor),
            splitView.trailingAnchor.constraint(equalTo: trailingAnchor),
            splitView.bottomAnchor.constraint(equalTo: bottomAnchor),
        ])

        sidebarTableView.selectRowIndexes(IndexSet(integer: 0), byExtendingSelection: false)
    }

    // MARK: - Pane Selection

    /// Selects the pane at the given index, showing its detail view.
    public func selectPane(at index: Int) {
        guard index >= 0, index < panes.count else { return }
        selectedIndex = index
        currentDetailView?.removeFromSuperview()

        let paneView: NSView
        if let cached = cachedViews[index] {
            paneView = cached
        } else {
            paneView = panes[index].makeView()
            cachedViews[index] = paneView
        }

        paneView.translatesAutoresizingMaskIntoConstraints = false

        let wrapper = NSView()
        wrapper.translatesAutoresizingMaskIntoConstraints = false
        wrapper.addSubview(paneView)
        NSLayoutConstraint.activate([
            paneView.topAnchor.constraint(equalTo: wrapper.topAnchor, constant: Self.detailPadding),
            paneView.leadingAnchor.constraint(equalTo: wrapper.leadingAnchor, constant: Self.detailPadding),
            paneView.trailingAnchor.constraint(equalTo: wrapper.trailingAnchor, constant: -Self.detailPadding),
            paneView.bottomAnchor.constraint(equalTo: wrapper.bottomAnchor, constant: -Self.detailPadding),
        ])

        detailContainer.documentView = wrapper

        if let clipView = detailContainer.contentView as? NSClipView {
            wrapper.widthAnchor.constraint(equalTo: clipView.widthAnchor).isActive = true
        }

        currentDetailView = wrapper
    }

    // MARK: - NSTableViewDataSource

    public func numberOfRows(in tableView: NSTableView) -> Int { panes.count }

    // MARK: - NSTableViewDelegate

    public func tableView(_ tableView: NSTableView, viewFor tableColumn: NSTableColumn?, row: Int) -> NSView? {
        let pane = panes[row]
        let identifier = NSUserInterfaceItemIdentifier("SettingsPaneCell")
        let cell = tableView.makeView(withIdentifier: identifier, owner: nil) as? NSTableCellView ?? {
            let c = NSTableCellView()
            c.identifier = identifier
            let imageView = NSImageView()
            imageView.translatesAutoresizingMaskIntoConstraints = false
            let textField = NSTextField(labelWithString: "")
            textField.translatesAutoresizingMaskIntoConstraints = false
            c.addSubview(imageView)
            c.addSubview(textField)
            c.imageView = imageView
            c.textField = textField
            NSLayoutConstraint.activate([
                imageView.leadingAnchor.constraint(equalTo: c.leadingAnchor, constant: 4),
                imageView.centerYAnchor.constraint(equalTo: c.centerYAnchor),
                imageView.widthAnchor.constraint(equalToConstant: 16),
                imageView.heightAnchor.constraint(equalToConstant: 16),
                textField.leadingAnchor.constraint(equalTo: imageView.trailingAnchor, constant: 6),
                textField.centerYAnchor.constraint(equalTo: c.centerYAnchor),
                textField.trailingAnchor.constraint(lessThanOrEqualTo: c.trailingAnchor, constant: -4),
            ])
            return c
        }()

        cell.textField?.stringValue = pane.title
        cell.textField?.font = .systemFont(ofSize: 13)
        cell.imageView?.image = NSImage(systemSymbolName: pane.systemImage, accessibilityDescription: nil)
        return cell
    }

    public func tableViewSelectionDidChange(_ notification: Notification) {
        let row = sidebarTableView.selectedRow
        guard row >= 0, row < panes.count else { return }
        selectPane(at: row)
    }

    // MARK: - NSSplitViewDelegate

    public func splitView(_ splitView: NSSplitView, canCollapseSubview subview: NSView) -> Bool { false }

    public func splitView(_ splitView: NSSplitView, constrainMinCoordinate proposedMinimumPosition: CGFloat, ofSubviewAt dividerIndex: Int) -> CGFloat {
        Self.sidebarWidth
    }

    public func splitView(_ splitView: NSSplitView, constrainMaxCoordinate proposedMaximumPosition: CGFloat, ofSubviewAt dividerIndex: Int) -> CGFloat {
        Self.sidebarWidth
    }
}

// MARK: - Flipped Clip View

/// An NSClipView subclass with a flipped coordinate system so that
/// scroll view document content is pinned to the top-left.
private final class FlippedClipView: NSClipView {
    override var isFlipped: Bool { true }
}
