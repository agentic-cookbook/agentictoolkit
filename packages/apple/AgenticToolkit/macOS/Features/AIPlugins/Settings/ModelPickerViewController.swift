import AppKit
import SwiftUI
import AgenticToolkitCore
import AgenticToolkitCoreMacOS

/// A rich model row: name (bold) over its description over its capabilities line.
@MainActor
private final class ModelCellView: NSTableCellView {
    private let nameLabel = NSTextField(labelWithString: "")
    private let descLabel = NSTextField(labelWithString: "")
    private let capsLabel = NSTextField(labelWithString: "")

    init(identifier: NSUserInterfaceItemIdentifier) {
        super.init(frame: .zero)
        self.identifier = identifier
        nameLabel.font = .systemFont(ofSize: NSFont.systemFontSize, weight: .semibold)
        descLabel.font = .systemFont(ofSize: 11)
        capsLabel.font = .systemFont(ofSize: 10)
        for label in [nameLabel, descLabel, capsLabel] {
            label.lineBreakMode = .byTruncatingTail
            label.translatesAutoresizingMaskIntoConstraints = false
        }
        let stack = NSStackView(views: [nameLabel, descLabel, capsLabel])
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
    required init?(coder: NSCoder) { fatalError() }

    func configure(_ item: ModelPickerItem, palette: SemanticPalette, isCurrent: Bool) {
        nameLabel.stringValue = isCurrent ? "✓ \(item.id)" : item.id
        nameLabel.textColor = palette.primaryTextColor
        descLabel.stringValue = item.description ?? ""
        descLabel.textColor = palette.secondaryTextColor
        descLabel.isHidden = (item.description ?? "").isEmpty
        capsLabel.stringValue = item.capabilities ?? ""
        capsLabel.textColor = palette.nsColor(.tertiaryText)
        capsLabel.isHidden = (item.capabilities ?? "").isEmpty
    }
}

/// A themed, keyboard-driven model picker for an `NSPopover` (presented from the
/// config editor's Model field). A focused filter field on top; a table of models
/// showing name + description + capabilities. Up/down move the selection, Return
/// or a click chooses, Escape dismisses.
@MainActor
public final class ModelPickerViewController: NSViewController, Themeable {

    public var onSelect: ((String) -> Void)?
    public var onDismiss: (() -> Void)?

    private var allItems: [ModelPickerItem]
    private var filtered: [ModelPickerItem]
    private var initialSelection: String

    private let searchField = NSSearchField()
    private let tableView = NSTableView()
    private let scrollView = NSScrollView()
    private var themeObserver: ThemePaletteObserver?
    private let keyboard = PickerKeyboardController()

    private static let rowHeight: CGFloat = 56
    private static let cellID = NSUserInterfaceItemIdentifier("model.cell")

    public init(items: [ModelPickerItem], selected: String) {
        self.allItems = items
        self.filtered = items
        self.initialSelection = selected
        super.init(nibName: nil, bundle: nil)
        let visibleRows = min(max(items.count, 1), 6)
        let height = 16 + 24 /* search */ + 8 + CGFloat(visibleRows) * Self.rowHeight + 12
        preferredContentSize = NSSize(width: 380, height: min(height, 440))
    }

    @available(*, unavailable)
    public required init?(coder: NSCoder) { fatalError() }

    public override func loadView() {
        let root = NSView()
        root.wantsLayer = true

        searchField.placeholderString = "Filter models"
        searchField.delegate = self
        searchField.sendsWholeSearchString = false
        searchField.sendsSearchStringImmediately = true

        tableView.headerView = nil
        tableView.rowHeight = Self.rowHeight
        tableView.allowsEmptySelection = false
        tableView.allowsMultipleSelection = false
        tableView.selectionHighlightStyle = .regular
        tableView.dataSource = self
        tableView.delegate = self
        tableView.target = self
        tableView.action = #selector(rowClicked)
        let column = NSTableColumn(identifier: NSUserInterfaceItemIdentifier("model"))
        column.resizingMask = .autoresizingMask
        tableView.addTableColumn(column)

        scrollView.documentView = tableView
        scrollView.hasVerticalScroller = true
        scrollView.autohidesScrollers = true
        scrollView.borderType = .noBorder
        scrollView.drawsBackground = true

        [searchField, scrollView].forEach {
            $0.translatesAutoresizingMaskIntoConstraints = false
            root.addSubview($0)
        }
        NSLayoutConstraint.activate([
            searchField.topAnchor.constraint(equalTo: root.topAnchor, constant: 12),
            searchField.leadingAnchor.constraint(equalTo: root.leadingAnchor, constant: 12),
            searchField.trailingAnchor.constraint(equalTo: root.trailingAnchor, constant: -12),

            scrollView.topAnchor.constraint(equalTo: searchField.bottomAnchor, constant: 8),
            scrollView.leadingAnchor.constraint(equalTo: root.leadingAnchor, constant: 8),
            scrollView.trailingAnchor.constraint(equalTo: root.trailingAnchor, constant: -8),
            scrollView.bottomAnchor.constraint(equalTo: root.bottomAnchor, constant: -8)
        ])
        self.view = root
        themeObserver = ThemePaletteObserver { [weak self] palette in self?.applyTheme(palette) }
    }

    public override func viewDidLoad() {
        super.viewDidLoad()
        tableView.reloadData()
        selectRow(filtered.firstIndex(where: { $0.id == initialSelection }) ?? 0)
    }

    public override func viewDidAppear() {
        super.viewDidAppear()
        view.window?.makeFirstResponder(searchField)
        keyboard.onMoveSelection = { [weak self] delta in self?.moveSelection(by: delta) }
        keyboard.onChoose = { [weak self] in self?.chooseSelected() }
        keyboard.onCancel = { [weak self] in self?.onDismiss?() }
        keyboard.startEscapeMonitor(for: view.window)
    }

    public override func viewWillDisappear() {
        super.viewWillDisappear()
        keyboard.stopEscapeMonitor()
    }

    /// Replaces the model list (and current selection) after presentation — e.g.
    /// when a live `/models` fetch resolves while the popover is already open.
    /// Re-applies the active filter and keeps the selection visible.
    public func update(items: [ModelPickerItem], selected: String) {
        guard isViewLoaded, items != allItems || selected != initialSelection else { return }
        allItems = items
        initialSelection = selected
        applyFilter()
        selectRow(filtered.firstIndex(where: { $0.id == selected }) ?? 0)
    }

    // MARK: - Selection / filtering

    private func selectRow(_ index: Int) {
        guard !filtered.isEmpty else { return }
        let clamped = max(0, min(filtered.count - 1, index))
        tableView.selectRowIndexes([clamped], byExtendingSelection: false)
        tableView.scrollRowToVisible(clamped)
    }

    private func moveSelection(by delta: Int) {
        guard !filtered.isEmpty else { return }
        let current = tableView.selectedRow < 0 ? 0 : tableView.selectedRow
        selectRow(current + delta)
    }

    private func chooseSelected() {
        let row = tableView.selectedRow
        guard row >= 0, row < filtered.count else { return }
        onSelect?(filtered[row].id)
    }

    @objc private func rowClicked() {
        chooseSelected()
    }

    private func applyFilter() {
        let needle = searchField.stringValue.trimmingCharacters(in: .whitespaces).lowercased()
        filtered = needle.isEmpty ? allItems : allItems.filter { $0.matches(needle) }
        tableView.reloadData()
        selectRow(0)
    }

    // MARK: - Theme

    public func applyTheme(_ palette: SemanticPalette) {
        view.layer?.backgroundColor = palette.windowBackgroundColor.cgColor
        tableView.backgroundColor = palette.surfaceColor
        scrollView.backgroundColor = palette.surfaceColor
        tableView.reloadData()
    }
}

// MARK: - Table data source / delegate

extension ModelPickerViewController: NSTableViewDataSource, NSTableViewDelegate {

    public func numberOfRows(in tableView: NSTableView) -> Int { filtered.count }

    public func tableView(_ tableView: NSTableView, viewFor tableColumn: NSTableColumn?, row: Int) -> NSView? {
        guard row >= 0, row < filtered.count else { return nil }
        let cell = tableView.makeView(withIdentifier: Self.cellID, owner: nil) as? ModelCellView
            ?? ModelCellView(identifier: Self.cellID)
        cell.configure(filtered[row], palette: ThemePaletteObserver.currentPalette,
                       isCurrent: filtered[row].id == initialSelection)
        return cell
    }

    public func tableView(_ tableView: NSTableView, rowViewForRow row: Int) -> NSTableRowView? {
        ThemedTableRowView(frame: .zero)
    }
}

// MARK: - Search field delegate (keyboard)

extension ModelPickerViewController: NSSearchFieldDelegate {

    public func controlTextDidChange(_ obj: Notification) {
        applyFilter()
    }

    public func control(_ control: NSControl, textView: NSTextView,
                        doCommandBy commandSelector: Selector) -> Bool {
        keyboard.handle(commandSelector)
    }
}

// MARK: - SwiftUI host

/// Hosts ``ModelPickerViewController`` inside a SwiftUI `.popover`.
struct ModelPickerHost: NSViewControllerRepresentable {
    let items: [ModelPickerItem]
    let selected: String
    let onSelect: (String) -> Void
    let onDismiss: () -> Void

    func makeNSViewController(context: Context) -> ModelPickerViewController {
        let controller = ModelPickerViewController(items: items, selected: selected)
        controller.onSelect = onSelect
        controller.onDismiss = onDismiss
        return controller
    }

    func updateNSViewController(_ controller: ModelPickerViewController, context: Context) {
        controller.onSelect = onSelect
        controller.onDismiss = onDismiss
        // Forward a model list that arrived after the popover opened (async fetch).
        controller.update(items: items, selected: selected)
    }
}
