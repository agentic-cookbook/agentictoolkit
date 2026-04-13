import AppKit

@MainActor public protocol NotesListViewControllerDelegate: AnyObject {
    func notesListDidSelectNote(_ note: Note?)
    func notesListDidRequestNewNote()
}

public final class NotesListViewController: NSViewController {

    // MARK: - Public API

    public weak var delegate: NotesListViewControllerDelegate?

    /// Reload the displayed notes. Call on main thread after notes array changes.
    public func reload(notes: [Note], keepingSelectedID: UUID?) {
        allNotes = notes
        applySearch()
        if let id = keepingSelectedID,
           let idx = filteredNotes.firstIndex(where: { $0.id == id }) {
            tableView.selectRowIndexes(IndexSet(integer: idx), byExtendingSelection: false)
            tableView.scrollRowToVisible(idx)
        } else {
            tableView.deselectAll(nil)
        }
    }

    public var selectedNoteID: UUID? {
        let row = tableView.selectedRow
        guard row >= 0 && row < filteredNotes.count else { return nil }
        return filteredNotes[row].id
    }

    // MARK: - Properties

    private var allNotes: [Note] = []
    private var filteredNotes: [Note] = []

    private lazy var searchField: NSSearchField = {
        let sf = NSSearchField()
        sf.placeholderString = "Search notes"
        sf.delegate = self
        sf.translatesAutoresizingMaskIntoConstraints = false
        return sf
    }()

    private lazy var newNoteButton: NSButton = {
        let btn = NSButton()
        btn.isBordered = false
        btn.image = NSImage(systemSymbolName: "square.and.pencil", accessibilityDescription: "New Note")
        btn.image?.isTemplate = true
        btn.toolTip = "New note"
        btn.target = self
        btn.action = #selector(newNoteTapped)
        btn.translatesAutoresizingMaskIntoConstraints = false
        return btn
    }()

    private lazy var headerLabel: NSTextField = {
        let label = NSTextField(labelWithString: "Notes")
        label.font = .boldSystemFont(ofSize: 13)
        label.translatesAutoresizingMaskIntoConstraints = false
        return label
    }()

    private lazy var scrollView: NSScrollView = {
        let sv = NSScrollView()
        sv.hasVerticalScroller = true
        sv.autohidesScrollers = true
        sv.translatesAutoresizingMaskIntoConstraints = false
        return sv
    }()

    private lazy var tableView: NSTableView = {
        let tv = NSTableView()
        tv.headerView = nil
        tv.rowHeight = 60
        tv.selectionHighlightStyle = .regular
        tv.delegate = self
        tv.dataSource = self
        tv.rowSizeStyle = .custom
        let col = NSTableColumn(identifier: NSUserInterfaceItemIdentifier("note"))
        col.resizingMask = .autoresizingMask
        tv.addTableColumn(col)
        return tv
    }()

    // MARK: - View Lifecycle

    override public func loadView() {
        view = NSView()
        view.translatesAutoresizingMaskIntoConstraints = false
    }

    override public func viewDidLoad() {
        super.viewDidLoad()

        scrollView.documentView = tableView
        view.addSubview(headerLabel)
        view.addSubview(newNoteButton)
        view.addSubview(searchField)
        view.addSubview(scrollView)

        NSLayoutConstraint.activate([
            headerLabel.topAnchor.constraint(equalTo: view.topAnchor, constant: 12),
            headerLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 12),

            newNoteButton.centerYAnchor.constraint(equalTo: headerLabel.centerYAnchor),
            newNoteButton.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -12),
            newNoteButton.widthAnchor.constraint(equalToConstant: 24),
            newNoteButton.heightAnchor.constraint(equalToConstant: 24),

            searchField.topAnchor.constraint(equalTo: headerLabel.bottomAnchor, constant: 8),
            searchField.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 8),
            searchField.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -8),

            scrollView.topAnchor.constraint(equalTo: searchField.bottomAnchor, constant: 4),
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            scrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])
    }

    // MARK: - Actions

    @objc private func newNoteTapped() {
        delegate?.notesListDidRequestNewNote()
    }

    // MARK: - Filtering

    private func applySearch() {
        let query = searchField.stringValue.trimmingCharacters(in: .whitespaces).lowercased()
        if query.isEmpty {
            filteredNotes = allNotes
        } else {
            filteredNotes = allNotes.filter {
                $0.title.lowercased().contains(query) || $0.content.lowercased().contains(query)
            }
        }
        tableView.reloadData()
    }
}

// MARK: - NSSearchFieldDelegate

extension NotesListViewController: NSSearchFieldDelegate {
    public func controlTextDidChange(_ obj: Notification) {
        applySearch()
    }
}

// MARK: - NSTableViewDataSource

extension NotesListViewController: NSTableViewDataSource {
    public func numberOfRows(in tableView: NSTableView) -> Int {
        filteredNotes.count
    }
}

// MARK: - NSTableViewDelegate

extension NotesListViewController: NSTableViewDelegate {

    public func tableView(_ tableView: NSTableView, heightOfRow row: Int) -> CGFloat { 60 }

    public func tableView(_ tableView: NSTableView, viewFor tableColumn: NSTableColumn?, row: Int) -> NSView? {
        let note = filteredNotes[row]
        let id = NSUserInterfaceItemIdentifier("NoteCell")
        let cell = tableView.makeView(withIdentifier: id, owner: nil) as? NoteListCellView
            ?? NoteListCellView(identifier: id)
        cell.configure(with: note)
        return cell
    }

    public func tableViewSelectionDidChange(_ notification: Notification) {
        let row = tableView.selectedRow
        let note = (row >= 0 && row < filteredNotes.count) ? filteredNotes[row] : nil
        delegate?.notesListDidSelectNote(note)
    }
}

// MARK: - NoteListCellView

final class NoteListCellView: NSTableCellView {

    private static let relativeFormatter: RelativeDateTimeFormatter = {
        let f = RelativeDateTimeFormatter()
        f.unitsStyle = .abbreviated
        return f
    }()

    private let pinIndicator = NSImageView()
    private let titleLabel = NSTextField(labelWithString: "")
    private let dateLabel = NSTextField(labelWithString: "")
    private let previewLabel = NSTextField(labelWithString: "")

    init(identifier: NSUserInterfaceItemIdentifier) {
        super.init(frame: .zero)
        self.identifier = identifier
        setupViews()
    }

    required init?(coder: NSCoder) { fatalError() }

    private func setupViews() {
        titleLabel.font = .systemFont(ofSize: 13, weight: .medium)
        titleLabel.lineBreakMode = .byTruncatingTail
        titleLabel.translatesAutoresizingMaskIntoConstraints = false

        dateLabel.font = .systemFont(ofSize: 11)
        dateLabel.textColor = .secondaryLabelColor
        dateLabel.translatesAutoresizingMaskIntoConstraints = false

        previewLabel.font = .systemFont(ofSize: 11)
        previewLabel.textColor = .tertiaryLabelColor
        previewLabel.lineBreakMode = .byTruncatingTail
        previewLabel.translatesAutoresizingMaskIntoConstraints = false

        pinIndicator.image = NSImage(systemSymbolName: "pin.fill", accessibilityDescription: "Pinned")
        pinIndicator.contentTintColor = .systemOrange
        pinIndicator.translatesAutoresizingMaskIntoConstraints = false
        pinIndicator.setContentHuggingPriority(.required, for: .horizontal)

        addSubview(titleLabel)
        addSubview(dateLabel)
        addSubview(previewLabel)
        addSubview(pinIndicator)

        NSLayoutConstraint.activate([
            titleLabel.topAnchor.constraint(equalTo: topAnchor, constant: 8),
            titleLabel.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 12),
            titleLabel.trailingAnchor.constraint(equalTo: pinIndicator.leadingAnchor, constant: -4),

            pinIndicator.centerYAnchor.constraint(equalTo: titleLabel.centerYAnchor),
            pinIndicator.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -12),
            pinIndicator.widthAnchor.constraint(equalToConstant: 12),
            pinIndicator.heightAnchor.constraint(equalToConstant: 12),

            dateLabel.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 2),
            dateLabel.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 12),

            previewLabel.topAnchor.constraint(equalTo: dateLabel.bottomAnchor, constant: 2),
            previewLabel.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 12),
            previewLabel.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -12),
        ])
    }

    func configure(with note: Note) {
        titleLabel.stringValue = note.title
        dateLabel.stringValue = Self.relativeFormatter.localizedString(for: note.modifiedDate, relativeTo: Date())
        let preview = note.content
            .replacingOccurrences(of: "\n", with: " ")
            .trimmingCharacters(in: .whitespaces)
        previewLabel.stringValue = preview.isEmpty ? "(empty)" : String(preview.prefix(60))
        pinIndicator.isHidden = !note.isPinned
    }
}
