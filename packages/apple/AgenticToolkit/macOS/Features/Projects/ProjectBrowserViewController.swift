import AppKit
import AgenticToolkitCore
import AgenticToolkitCoreUI
import AgenticToolkitCoreMacOS

/// What the browser is for. The list is the same either way; only the payoff
/// for activating a row differs, which is why this is a mode and not two view
/// controllers (`dry`).
public enum ProjectBrowserMode: Sendable {
    /// Standing UI. Selection is reported as it changes; a double-click opens.
    case browser
    /// Presented to answer one question. Selection is reported the same way,
    /// but Return and double-click both mean "this one" and dismiss.
    case chooser
}

/// The registered projects under the folders that hold them, with a filter
/// field — the project counterpart of the file browser, and deliberately the
/// same shape: an outline of folders and leaves. The rows are registry rows
/// rather than directory entries, so a project appears here whether or not its
/// folder is currently reachable.
@MainActor
public final class ProjectBrowserViewController: NSViewController {

    public let mode: ProjectBrowserMode

    /// Called when the user picks a project for keeps (Return, double-click,
    /// or the chooser's Open button).
    public var onChoose: ((GitRepo) -> Void)?
    /// Called as the highlighted row changes, `nil` when nothing is selected.
    public var onSelectionChange: ((GitRepo?) -> Void)?

    private let coordinator: ProjectsCoordinator
    private let searchField = ThemedSearchField(placeholder: "Filter Projects")
    private let outline = ThemedOutlineView(role: .windowBackground)
    private let scrollView = ThemedScrollView()
    private let emptyLabel = ThemedLabel(role: .tertiaryText, textRole: .body)
    private var roots: [ProjectTreeNode] = []
    /// What the rows highlight, kept because a row is built long after the
    /// filter ran and has to be able to ask what it survived.
    private var query = ""
    private var changeObserver: NSObjectProtocol?

    public init(coordinator: ProjectsCoordinator, mode: ProjectBrowserMode = .browser) {
        self.coordinator = coordinator
        self.mode = mode
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    public required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    isolated deinit {
        if let changeObserver {
            NotificationCenter.default.removeObserver(changeObserver)
        }
    }

    public var selectedRepo: GitRepo? {
        selectedNode?.repo
    }

    private var selectedNode: ProjectTreeNode? {
        let row = outline.selectedRow
        guard row >= 0 else { return nil }
        return outline.item(atRow: row) as? ProjectTreeNode
    }

    // MARK: - View

    public override func loadView() {
        let container = ThemedBackgroundView(role: .windowBackground)

        searchField.delegate = self
        searchField.target = self
        searchField.action = #selector(filterChanged(_:))
        searchField.sendsWholeSearchString = false
        searchField.sendsSearchStringImmediately = true
        searchField.translatesAutoresizingMaskIntoConstraints = false
        searchField.accessibilityID("project-browser.filter")

        let column = NSTableColumn(identifier: NSUserInterfaceItemIdentifier("project"))
        column.resizingMask = .autoresizingMask
        outline.addTableColumn(column)
        outline.outlineTableColumn = column
        outline.headerView = nil
        outline.rowHeight = 24
        outline.indentationPerLevel = 14
        outline.style = .inset
        outline.allowsEmptySelection = true
        outline.allowsMultipleSelection = false
        outline.dataSource = self
        outline.delegate = self
        outline.target = self
        outline.doubleAction = #selector(rowDoubleClicked(_:))
        outline.autoresizesOutlineColumn = false
        outline.accessibilityID("project-browser.table")

        scrollView.documentView = outline
        scrollView.hasVerticalScroller = true
        scrollView.autohidesScrollers = true
        scrollView.translatesAutoresizingMaskIntoConstraints = false

        emptyLabel.stringValue = "No projects yet — run File ▸ Scan for Projects."
        emptyLabel.alignment = .center
        emptyLabel.translatesAutoresizingMaskIntoConstraints = false
        emptyLabel.isHidden = true
        emptyLabel.accessibilityID("project-browser.empty")

        container.addSubview(searchField)
        container.addSubview(scrollView)
        container.addSubview(emptyLabel)

        NSLayoutConstraint.activate([
            searchField.topAnchor.constraint(equalTo: container.topAnchor, constant: 10),
            searchField.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: 10),
            searchField.trailingAnchor.constraint(equalTo: container.trailingAnchor, constant: -10),

            scrollView.topAnchor.constraint(equalTo: searchField.bottomAnchor, constant: 8),
            scrollView.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            scrollView.bottomAnchor.constraint(equalTo: container.bottomAnchor),

            emptyLabel.centerXAnchor.constraint(equalTo: scrollView.centerXAnchor),
            emptyLabel.centerYAnchor.constraint(equalTo: scrollView.centerYAnchor),
            emptyLabel.leadingAnchor.constraint(greaterThanOrEqualTo: container.leadingAnchor, constant: 20)
        ])

        self.view = container
    }

    public override func viewDidLoad() {
        super.viewDidLoad()
        applyFilter()
        changeObserver = NotificationCenter.default.addObserver(
            forName: ProjectsCoordinator.didChangeNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            MainActor.assumeIsolated { self?.applyFilter() }
        }
    }

    public override func viewDidAppear() {
        super.viewDidAppear()
        view.window?.makeFirstResponder(searchField)
    }

    // MARK: - Filtering

    /// A project that matches brings its folders with it, so a filtered tree
    /// still says where the survivors live. `ProjectFilter` owns what a match
    /// is; here it only decides which rows are drawn.
    private func applyFilter() {
        query = searchField.stringValue.trimmingCharacters(in: .whitespaces)
        let previous = selectedRepo?.id
        let all = coordinator.repos
        let matching = all.filter { ProjectFilter.matches($0, query: query) }
        roots = ProjectTree.build(from: matching)
        outline.reloadData()
        // Opened all the way down. The tree is what the user came to read, and
        // a chooser that hides every project behind a disclosure triangle
        // answers the question with more questions.
        outline.expandItem(nil, expandChildren: true)

        emptyLabel.isHidden = !matching.isEmpty
        if matching.isEmpty {
            emptyLabel.stringValue = all.isEmpty
                ? "No projects yet — run File ▸ Scan for Projects."
                : "No projects match “\(searchField.stringValue)”."
        }

        // Keep whatever was selected if it survived the filter, otherwise take
        // the first project so Return always has an answer. A folder is never
        // the automatic choice: it is not something the dialog can open.
        let projects = roots.flatMap { $0.repositoriesInDisplayOrder }
        if let previous, let node = projects.first(where: { $0.repo?.id == previous }) {
            select(node)
        } else if let first = projects.first {
            select(first)
        } else {
            onSelectionChange?(nil)
        }
    }

    private func select(_ node: ProjectTreeNode) {
        let row = outline.row(forItem: node)
        guard row >= 0 else { return }
        select(row: row)
    }

    private func select(row: Int) {
        outline.selectRowIndexes(IndexSet(integer: row), byExtendingSelection: false)
        outline.scrollRowToVisible(row)
    }

    @objc private func filterChanged(_ sender: Any?) {
        applyFilter()
    }

    @objc private func rowDoubleClicked(_ sender: Any?) {
        guard let node = selectedNode else { return }
        // A folder has nothing to open, so a double-click means what it means
        // everywhere else: show me what is inside, or stop showing me.
        if node.isFolder {
            if outline.isItemExpanded(node) {
                outline.collapseItem(node)
            } else {
                outline.expandItem(node)
            }
            return
        }
        chooseSelection()
    }

    /// Activates the selection. Public so a hosting window can wire it to a
    /// button or to Return without reaching into the list.
    public func chooseSelection() {
        guard let repo = selectedRepo else { return }
        onChoose?(repo)
    }

    private func moveSelection(by delta: Int) {
        let rows = outline.numberOfRows
        guard rows > 0 else { return }
        let current = outline.selectedRow < 0 ? -1 : outline.selectedRow
        select(row: min(max(current + delta, 0), rows - 1))
    }
}

// MARK: - Filter field

extension ProjectBrowserViewController: NSSearchFieldDelegate {

    public func controlTextDidChange(_ notification: Notification) {
        applyFilter()
    }

    /// The arrow keys and Return have to be taken from the field editor, or
    /// they never reach the list: a filter you must tab out of to use is not a
    /// filter (`principle-of-least-astonishment`).
    public func control(
        _ control: NSControl,
        textView: NSTextView,
        doCommandBy commandSelector: Selector
    ) -> Bool {
        switch commandSelector {
        case #selector(NSResponder.insertNewline(_:)):
            chooseSelection()
            return true
        case #selector(NSResponder.moveDown(_:)):
            moveSelection(by: 1)
            return true
        case #selector(NSResponder.moveUp(_:)):
            moveSelection(by: -1)
            return true
        default:
            return false
        }
    }
}

// MARK: - Outline

extension ProjectBrowserViewController: NSOutlineViewDataSource, NSOutlineViewDelegate {

    public func outlineView(_ outlineView: NSOutlineView, numberOfChildrenOfItem item: Any?) -> Int {
        children(of: item).count
    }

    public func outlineView(_ outlineView: NSOutlineView, child index: Int, ofItem item: Any?) -> Any {
        children(of: item)[index]
    }

    public func outlineView(_ outlineView: NSOutlineView, isItemExpandable item: Any) -> Bool {
        guard let node = item as? ProjectTreeNode else { return false }
        return !node.children.isEmpty
    }

    public func outlineView(_ outlineView: NSOutlineView, rowViewForItem item: Any) -> NSTableRowView? {
        ThemedTableRowView()
    }

    public func outlineView(
        _ outlineView: NSOutlineView,
        viewFor tableColumn: NSTableColumn?,
        item: Any
    ) -> NSView? {
        guard let node = item as? ProjectTreeNode else { return nil }
        return ProjectRowView(node: node, query: query)
    }

    public func outlineViewSelectionDidChange(_ notification: Notification) {
        onSelectionChange?(selectedRepo)
    }

    private func children(of item: Any?) -> [ProjectTreeNode] {
        guard let item else { return roots }
        return (item as? ProjectTreeNode)?.children ?? []
    }
}

/// One row: an icon and a name, with the characters the filter matched picked
/// out. The folder it lives in is the row above it, so the row itself no longer
/// has to spell out a path — which is the whole point
/// of showing the hierarchy. Every row is a project that was on disk as of the
/// last scan; one that is not is deleted rather than dimmed, so there is no
/// un-openable row to explain.
@MainActor
private final class ProjectRowView: NSView {

    init(node: ProjectTreeNode, query: String) {
        super.init(frame: .zero)

        let symbol = node.isFolder ? "folder.fill" : "shippingbox.fill"
        let icon = NSImageView(image: NSImage(
            systemSymbolName: symbol,
            accessibilityDescription: node.isFolder ? "Folder" : "Project"
        ) ?? NSImage())
        icon.contentTintColor = resolvedThemeScope.palette.nsColor(
            node.isFolder ? .secondaryText : .accent
        )
        icon.setContentHuggingPriority(.required, for: .horizontal)

        let label = ThemedHighlightLabel(
            string: node.name,
            highlighting: ProjectFilter.ranges(of: query, in: node.name),
            role: .primaryText,
            textRole: node.isFolder ? .caption : .body
        )
        label.lineBreakMode = .byTruncatingMiddle
        label.cell?.usesSingleLineMode = true

        let stack = NSStackView(views: [icon, label])
        stack.orientation = .horizontal
        stack.alignment = .centerY
        stack.spacing = 6
        stack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stack)

        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 2),
            stack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -8),
            stack.centerYAnchor.constraint(equalTo: centerYAnchor),
            icon.widthAnchor.constraint(equalToConstant: 16)
        ])
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }
}
