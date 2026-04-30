import AppKit
import Combine

/// Displays the list of terminal sessions in a sidebar table view.
@MainActor
public final class TerminalSessionListViewController: NSViewController, NSTableViewDataSource, NSTableViewDelegate {

    public let sessionManager: TerminalSessionManager
    private let tableView = NSTableView()
    private let scrollView = NSScrollView()
    private var cancellables = Set<AnyCancellable>()
    private var isUpdatingSelection = false

    public init(sessionManager: TerminalSessionManager) {
        self.sessionManager = sessionManager
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    public required init?(coder: NSCoder) { fatalError() }

    public override func loadView() {
        let container = NSView()

        let column = NSTableColumn(identifier: NSUserInterfaceItemIdentifier("SessionColumn"))
        column.title = ""
        column.resizingMask = .autoresizingMask
        tableView.addTableColumn(column)
        tableView.headerView = nil
        tableView.style = .sourceList
        tableView.usesAlternatingRowBackgroundColors = false
        tableView.allowsEmptySelection = false
        tableView.dataSource = self
        tableView.delegate = self
        tableView.rowSizeStyle = .custom
        tableView.usesAutomaticRowHeights = true

        let menu = NSMenu()
        menu.addItem(withTitle: "Remove Session", action: #selector(closeSessionFromMenu(_:)), keyEquivalent: "")
        tableView.menu = menu

        scrollView.documentView = tableView
        scrollView.hasVerticalScroller = true
        scrollView.autohidesScrollers = true
        scrollView.translatesAutoresizingMaskIntoConstraints = false

        let addButton = NSButton(image: NSImage(systemSymbolName: "plus", accessibilityDescription: "New Session")!,
                                 target: self, action: #selector(addSession))
        addButton.bezelStyle = .accessoryBarAction
        addButton.isBordered = false
        addButton.toolTip = "New Session"
        addButton.translatesAutoresizingMaskIntoConstraints = false

        let bottomBar = NSView()
        bottomBar.translatesAutoresizingMaskIntoConstraints = false
        bottomBar.addSubview(addButton)

        let separator = NSBox()
        separator.boxType = .separator
        separator.translatesAutoresizingMaskIntoConstraints = false

        container.addSubview(scrollView)
        container.addSubview(separator)
        container.addSubview(bottomBar)

        NSLayoutConstraint.activate([
            scrollView.topAnchor.constraint(equalTo: container.topAnchor),
            scrollView.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            scrollView.bottomAnchor.constraint(equalTo: separator.topAnchor),

            separator.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            separator.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            separator.bottomAnchor.constraint(equalTo: bottomBar.topAnchor),

            bottomBar.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            bottomBar.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            bottomBar.bottomAnchor.constraint(equalTo: container.bottomAnchor),
            bottomBar.heightAnchor.constraint(equalToConstant: 28),

            addButton.leadingAnchor.constraint(equalTo: bottomBar.leadingAnchor, constant: 8),
            addButton.centerYAnchor.constraint(equalTo: bottomBar.centerYAnchor)
        ])

        self.view = container
    }

    public override func viewDidLoad() {
        super.viewDidLoad()

        sessionManager.$sessions
            .receive(on: RunLoop.main)
            .sink { [weak self] _ in self?.reloadAndRestoreSelection() }
            .store(in: &cancellables)

        sessionManager.$selectedSessionID
            .receive(on: RunLoop.main)
            .sink { [weak self] selectedID in
                guard let self, !self.isUpdatingSelection else { return }
                self.syncTableSelection(to: selectedID)
            }
            .store(in: &cancellables)
    }

    public func numberOfRows(in tableView: NSTableView) -> Int {
        sessionManager.sessions.count
    }

    public func tableView(_ tableView: NSTableView, viewFor tableColumn: NSTableColumn?, row: Int) -> NSView? {
        guard row < sessionManager.sessions.count else { return nil }
        let session = sessionManager.sessions[row]

        let cell = tableView.makeView(withIdentifier: TerminalSessionRowCellView.identifier, owner: nil) as? TerminalSessionRowCellView
            ?? TerminalSessionRowCellView(frame: .zero)
        cell.identifier = TerminalSessionRowCellView.identifier
        cell.configure(with: session)
        return cell
    }

    public func tableViewSelectionDidChange(_ notification: Notification) {
        let selectedRow = tableView.selectedRow
        guard selectedRow >= 0, selectedRow < sessionManager.sessions.count else { return }

        isUpdatingSelection = true
        sessionManager.selectSession(id: sessionManager.sessions[selectedRow].id)
        isUpdatingSelection = false
    }

    @objc private func addSession() {
        sessionManager.addSession()
    }

    @objc private func closeSessionFromMenu(_ sender: Any) {
        let clickedRow = tableView.clickedRow
        guard clickedRow >= 0, clickedRow < sessionManager.sessions.count else { return }
        sessionManager.removeSession(id: sessionManager.sessions[clickedRow].id)
    }

    private func reloadAndRestoreSelection() {
        tableView.reloadData()
        syncTableSelection(to: sessionManager.selectedSessionID)
    }

    private func syncTableSelection(to selectedID: UUID?) {
        guard let id = selectedID,
              let index = sessionManager.sessions.firstIndex(where: { $0.id == id }) else {
            tableView.deselectAll(nil)
            return
        }
        if tableView.selectedRow != index {
            tableView.selectRowIndexes(IndexSet(integer: index), byExtendingSelection: false)
            tableView.scrollRowToVisible(index)
        }
    }
}
