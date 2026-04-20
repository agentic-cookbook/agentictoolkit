import AppKit

/// A reusable split-pane settings view with a sidebar topic list and a detail area.
///
/// The app provides a list of `SettingsTopic` value objects and a closure that
/// maps each topic to its detail pane (matched by the topic's `id`).
@MainActor
public final class SettingsView: NSView {
    private let topics: [SettingsTopic]
    private let paneBuilder: (SettingsTopic) -> NSView
    private var selectedTopic: SettingsTopic

    private let splitView = NSSplitView()
    private let sidebarTableView = NSTableView()
    private let detailContainer: NSScrollView = {
        let sv = NSScrollView()
        sv.contentView = FlippedClipView()
        return sv
    }()
    private var currentDetailView: NSView?
    private var needsInitialDividerPosition = true

    /// Topic IDs whose detail wrapper should be pinned to the full height of
    /// the scroll view (e.g. panes containing their own split view).
    public var fullHeightTopicIDs: Set<String> = []

    private static var sidebarWidth: CGFloat { 180 }

    /// Creates a settings view.
    ///
    /// - Parameters:
    ///   - topics: The ordered list of sidebar topics. Must not be empty.
    ///   - initialTopicID: The ID of the topic to select on first display.
    ///     Defaults to the first topic's ID.
    ///   - paneBuilder: A closure that returns the detail pane for a given topic.
    /// - Precondition: `topics` must contain at least one element.
    public init(
        topics: [SettingsTopic],
        initialTopicID: String? = nil,
        paneBuilder: @escaping (SettingsTopic) -> NSView
    ) {
        precondition(!topics.isEmpty, "SettingsView requires at least one topic")
        self.topics = topics
        self.paneBuilder = paneBuilder
        let initial = initialTopicID.flatMap { id in topics.first { $0.id == id } } ?? topics[0]
        self.selectedTopic = initial
        super.init(frame: .zero)
        setupViews()
        selectTopic(selectedTopic)
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
        let column = NSTableColumn(identifier: NSUserInterfaceItemIdentifier("topic"))
        column.title = ""
        sidebarTableView.addTableColumn(column)
        sidebarTableView.headerView = nil
        sidebarTableView.dataSource = self
        sidebarTableView.delegate = self
        sidebarTableView.rowHeight = 28
        sidebarTableView.style = .sourceList

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

        if let idx = topics.firstIndex(of: selectedTopic) {
            sidebarTableView.selectRowIndexes(IndexSet(integer: idx), byExtendingSelection: false)
        }
    }

    // MARK: - Topic Selection

    private func selectTopic(_ topic: SettingsTopic) {
        selectedTopic = topic
        currentDetailView?.removeFromSuperview()

        let pane = paneBuilder(topic)
        pane.translatesAutoresizingMaskIntoConstraints = false

        let padding: CGFloat = 20
        let wrapper = NSView()
        wrapper.translatesAutoresizingMaskIntoConstraints = false
        wrapper.addSubview(pane)
        NSLayoutConstraint.activate([
            pane.topAnchor.constraint(equalTo: wrapper.topAnchor, constant: padding),
            pane.leadingAnchor.constraint(equalTo: wrapper.leadingAnchor, constant: padding),
            pane.trailingAnchor.constraint(equalTo: wrapper.trailingAnchor, constant: -padding),
            pane.bottomAnchor.constraint(equalTo: wrapper.bottomAnchor, constant: -padding),
        ])

        detailContainer.documentView = wrapper

        let clipView = detailContainer.contentView
        wrapper.widthAnchor.constraint(equalTo: clipView.widthAnchor).isActive = true
        if fullHeightTopicIDs.contains(topic.id) {
            wrapper.heightAnchor.constraint(equalTo: clipView.heightAnchor).isActive = true
        }

        currentDetailView = wrapper
    }

    /// Programmatically selects the topic with the given ID. No-op if not found.
    public func selectTopic(id: String) {
        guard let topic = topics.first(where: { $0.id == id }),
              let idx = topics.firstIndex(of: topic) else { return }
        sidebarTableView.selectRowIndexes(IndexSet(integer: idx), byExtendingSelection: false)
        selectTopic(topic)
    }

}

// MARK: - Sidebar Table

extension SettingsView: NSTableViewDataSource, NSTableViewDelegate {

    public func numberOfRows(in tableView: NSTableView) -> Int { topics.count }

    public func tableView(_ tableView: NSTableView, viewFor tableColumn: NSTableColumn?, row: Int) -> NSView? {
        guard row >= 0, row < topics.count else { return nil }
        let topic = topics[row]
        let identifier = NSUserInterfaceItemIdentifier("TopicCell")
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

        cell.textField?.stringValue = topic.title
        cell.textField?.font = .systemFont(ofSize: 13)
        cell.imageView?.image = NSImage(systemSymbolName: topic.systemImage, accessibilityDescription: nil)
        return cell
    }

    public func tableViewSelectionDidChange(_ notification: Notification) {
        let row = sidebarTableView.selectedRow
        guard row >= 0, row < topics.count else { return }
        selectTopic(topics[row])
    }
}

// MARK: - Split View

extension SettingsView: NSSplitViewDelegate {

    public func splitView(_ splitView: NSSplitView, canCollapseSubview subview: NSView) -> Bool { false }

    public func splitView(_ splitView: NSSplitView, constrainMinCoordinate proposedMinimumPosition: CGFloat,
                          ofSubviewAt dividerIndex: Int) -> CGFloat {
        Self.sidebarWidth
    }

    public func splitView(_ splitView: NSSplitView, constrainMaxCoordinate proposedMaximumPosition: CGFloat,
                          ofSubviewAt dividerIndex: Int) -> CGFloat {
        Self.sidebarWidth
    }
}
