import AppKit

/// A reusable split-pane settings view with a sidebar topic list and a detail area.
///
/// Generic over any `SettingsTopic` type. The app provides a closure that maps
/// each topic to its detail pane.
@MainActor
public final class SettingsView<Topic: SettingsTopic>: NSView,
    NSTableViewDataSource, NSTableViewDelegate, NSSplitViewDelegate
{
    private let topics: [Topic]
    private let paneBuilder: (Topic) -> NSView
    private var selectedTopic: Topic

    private let splitView = NSSplitView()
    private let sidebarTableView = NSTableView()
    private let detailContainer: NSScrollView = {
        let sv = NSScrollView()
        sv.contentView = FlippedClipView()
        return sv
    }()
    private var currentDetailView: NSView?
    private var needsInitialDividerPosition = true

    /// Topics that should have their detail wrapper pinned to the full height
    /// of the scroll view (e.g. panes with their own split views).
    public var fullHeightTopics: Set<Topic> = []

    private static var sidebarWidth: CGFloat { 180 }

    /// Creates a settings view.
    ///
    /// - Parameters:
    ///   - topics: The ordered list of sidebar topics.
    ///   - initialTopic: The topic to select on first display. Defaults to the first topic.
    ///   - paneBuilder: A closure that returns the detail pane for a given topic.
    public init(
        topics: [Topic],
        initialTopic: Topic? = nil,
        paneBuilder: @escaping (Topic) -> NSView
    ) {
        self.topics = topics
        self.paneBuilder = paneBuilder
        self.selectedTopic = initialTopic ?? topics[0]
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

    private func selectTopic(_ topic: Topic) {
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
        if fullHeightTopics.contains(topic) {
            wrapper.heightAnchor.constraint(equalTo: clipView.heightAnchor).isActive = true
        }

        currentDetailView = wrapper
    }

    /// Programmatically select a topic.
    public func select(topic: Topic) {
        guard let idx = topics.firstIndex(of: topic) else { return }
        sidebarTableView.selectRowIndexes(IndexSet(integer: idx), byExtendingSelection: false)
        selectTopic(topic)
    }

    // MARK: - NSTableViewDataSource

    public func numberOfRows(in tableView: NSTableView) -> Int { topics.count }

    // MARK: - NSTableViewDelegate

    public func tableView(_ tableView: NSTableView, viewFor tableColumn: NSTableColumn?, row: Int) -> NSView? {
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

    // MARK: - NSSplitViewDelegate

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
