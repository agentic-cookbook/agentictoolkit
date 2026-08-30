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

/// A list of the registered projects with a filter field — the project
/// counterpart of the file browser: the same shape, but the rows are registry
/// rows rather than directory entries, so a project appears here whether or
/// not its folder is currently reachable.
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
    private let table = ThemedTableView(role: .windowBackground)
    private let scrollView = ThemedScrollView()
    private let emptyLabel = ThemedLabel(role: .tertiaryText, textRole: .body)
    private var filtered: [GitRepo] = []
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
        let row = table.selectedRow
        guard row >= 0, row < filtered.count else { return nil }
        return filtered[row]
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
        table.addTableColumn(column)
        table.headerView = nil
        table.rowHeight = 40
        table.style = .inset
        table.allowsEmptySelection = true
        table.allowsMultipleSelection = false
        table.dataSource = self
        table.delegate = self
        table.target = self
        table.doubleAction = #selector(rowDoubleClicked(_:))
        table.accessibilityID("project-browser.table")

        scrollView.documentView = table
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

    /// Substring match on both the name and the path, because the two things
    /// someone remembers about a project are what they call it and where they
    /// keep it.
    private func applyFilter() {
        let query = searchField.stringValue.trimmingCharacters(in: .whitespaces).lowercased()
        let previous = selectedRepo?.id
        let all = coordinator.repos
        filtered = query.isEmpty ? all : all.filter {
            $0.name.lowercased().contains(query) || $0.path.lowercased().contains(query)
        }
        table.reloadData()
        emptyLabel.isHidden = !filtered.isEmpty
        if filtered.isEmpty {
            emptyLabel.stringValue = all.isEmpty
                ? "No projects yet — run File ▸ Scan for Projects."
                : "No projects match “\(searchField.stringValue)”."
        }

        // Keep whatever was selected if it survived the filter, otherwise take
        // the first row so Return always has an answer.
        if let previous, let index = filtered.firstIndex(where: { $0.id == previous }) {
            select(row: index)
        } else if !filtered.isEmpty {
            select(row: 0)
        } else {
            onSelectionChange?(nil)
        }
    }

    private func select(row: Int) {
        table.selectRowIndexes(IndexSet(integer: row), byExtendingSelection: false)
        table.scrollRowToVisible(row)
    }

    @objc private func filterChanged(_ sender: Any?) {
        applyFilter()
    }

    @objc private func rowDoubleClicked(_ sender: Any?) {
        chooseSelection()
    }

    /// Activates the selection. Public so a hosting window can wire it to a
    /// button or to Return without reaching into the table.
    public func chooseSelection() {
        guard let repo = selectedRepo else { return }
        onChoose?(repo)
    }

    private func moveSelection(by delta: Int) {
        guard !filtered.isEmpty else { return }
        let current = table.selectedRow < 0 ? -1 : table.selectedRow
        select(row: min(max(current + delta, 0), filtered.count - 1))
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

// MARK: - Table

extension ProjectBrowserViewController: NSTableViewDataSource, NSTableViewDelegate {

    public func numberOfRows(in tableView: NSTableView) -> Int {
        filtered.count
    }

    public func tableView(_ tableView: NSTableView, rowViewForRow row: Int) -> NSTableRowView? {
        ThemedTableRowView()
    }

    public func tableView(
        _ tableView: NSTableView,
        viewFor tableColumn: NSTableColumn?,
        row: Int
    ) -> NSView? {
        guard row < filtered.count else { return nil }
        return ProjectRowView(repo: filtered[row])
    }

    public func tableViewSelectionDidChange(_ notification: Notification) {
        onSelectionChange?(selectedRepo)
    }
}

/// Name over path, with a missing project dimmed and labelled rather than
/// hidden: the settings are still there, and hiding the row would make a
/// briefly-unmounted volume look like data loss.
@MainActor
private final class ProjectRowView: NSView {

    init(repo: GitRepo) {
        super.init(frame: .zero)

        let name = ThemedLabel(string: repo.name, role: repo.isMissing ? .tertiaryText : .primaryText)
        let subtitle = ThemedLabel(
            string: repo.isMissing ? "Missing — \(abbreviate(repo.path))" : abbreviate(repo.path),
            role: repo.isMissing ? .warning : .secondaryText,
            textRole: .caption
        )
        subtitle.lineBreakMode = .byTruncatingMiddle
        subtitle.cell?.usesSingleLineMode = true

        let stack = NSStackView(views: [name, subtitle])
        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = 1
        stack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stack)

        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 8),
            stack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -8),
            stack.centerYAnchor.constraint(equalTo: centerYAnchor)
        ])
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    private func abbreviate(_ path: String) -> String {
        let home = FileManager.default.homeDirectoryForCurrentUser.path
        guard path.hasPrefix(home) else { return path }
        return "~" + path.dropFirst(home.count)
    }
}
