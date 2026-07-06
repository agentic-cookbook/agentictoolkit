import AppKit
import AIPluginKit
import AgenticToolkitCore
import AgenticToolkitCoreMacOS

/// One selectable row in the provider picker: a provider template plus the
/// display name of the plugin that serves it (its "configuration type").
public struct ProviderPickerRow: Equatable, Sendable {
    public let available: AIPluginManager.AvailableProviderTemplate
    public let configType: String

    public init(available: AIPluginManager.AvailableProviderTemplate, configType: String) {
        self.available = available
        self.configType = configType
    }

    public var providerName: String { available.template.displayName }
}

/// Pure, testable substring filter over provider rows (name + configuration type).
public enum ProviderPickerFilter {
    public static func filter(_ rows: [ProviderPickerRow], query: String) -> [ProviderPickerRow] {
        let needle = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !needle.isEmpty else { return rows }
        return rows.filter {
            $0.providerName.lowercased().contains(needle) || $0.configType.lowercased().contains(needle)
        }
    }
}

/// Modal provider picker (presented via ``ProviderPicker/present(over:rows:onChoose:)``).
///
/// A focused filter field on top; a two-column table (provider name /
/// configuration type) over a draggable split from a provider-info pane;
/// Cancel / Choose below. Fully keyboard-driven: up/down move the selection and
/// mirror it into the filter field, Return chooses, Escape cancels. Themed via
/// the toolkit palette and user-resizable.
@MainActor
public final class ProviderPickerViewController: NSViewController, Themeable {

    /// Called with the chosen template, or `nil` on cancel. Set by the presenter.
    public var completion: ((AIPluginManager.AvailableProviderTemplate?) -> Void)?

    private let allRows: [ProviderPickerRow]
    private var filteredRows: [ProviderPickerRow]

    private let searchField = NSSearchField()
    private let tableView = NSTableView()
    private let tableScroll = NSScrollView()
    private let infoTextView = NSTextView()
    private let infoScroll = NSScrollView()
    private let splitView = NSSplitView()
    private let cancelButton = NSButton()
    private let chooseButton = NSButton()

    private var themeObserver: ThemePaletteObserver?
    private var didSetInitialSplit = false
    private var escapeMonitor: Any?

    private static let nameColumnID = NSUserInterfaceItemIdentifier("provider.name")
    private static let typeColumnID = NSUserInterfaceItemIdentifier("provider.type")

    public init(rows: [ProviderPickerRow]) {
        self.allRows = rows
        self.filteredRows = rows
        super.init(nibName: nil, bundle: nil)
        let rowCount = max(rows.count, 1)
        let listHeight = min(CGFloat(rowCount) * 24 + 26 /* header + pad */, 460)
        let height = 16 + 26 /* search */ + 8 + listHeight + 8 + 150 /* info */ + 10 + 32 /* buttons */ + 16
        self.preferredContentSize = NSSize(width: 760, height: height)
    }

    @available(*, unavailable)
    public required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    // MARK: - View tree

    public override func loadView() {
        let root = NSView()
        root.wantsLayer = true

        configureSearchField()
        configureTable()
        configureInfo()
        configureSplit()
        configureButtons()

        [searchField, splitView, cancelButton, chooseButton].forEach {
            $0.translatesAutoresizingMaskIntoConstraints = false
            root.addSubview($0)
        }

        NSLayoutConstraint.activate([
            searchField.topAnchor.constraint(equalTo: root.topAnchor, constant: 16),
            searchField.leadingAnchor.constraint(equalTo: root.leadingAnchor, constant: 16),
            searchField.trailingAnchor.constraint(equalTo: root.trailingAnchor, constant: -16),

            splitView.topAnchor.constraint(equalTo: searchField.bottomAnchor, constant: 8),
            splitView.leadingAnchor.constraint(equalTo: root.leadingAnchor, constant: 16),
            splitView.trailingAnchor.constraint(equalTo: root.trailingAnchor, constant: -16),
            splitView.bottomAnchor.constraint(equalTo: cancelButton.topAnchor, constant: -10),

            chooseButton.trailingAnchor.constraint(equalTo: root.trailingAnchor, constant: -16),
            chooseButton.bottomAnchor.constraint(equalTo: root.bottomAnchor, constant: -16),
            cancelButton.trailingAnchor.constraint(equalTo: chooseButton.leadingAnchor, constant: -10),
            cancelButton.centerYAnchor.constraint(equalTo: chooseButton.centerYAnchor)
        ])

        self.view = root
        themeObserver = ThemePaletteObserver { [weak self] palette in self?.applyTheme(palette) }
    }

    public override func viewDidLoad() {
        super.viewDidLoad()
        reloadTable()
        selectRow(0)
    }

    public override func viewDidLayout() {
        super.viewDidLayout()
        if !didSetInitialSplit, splitView.bounds.height > 200 {
            didSetInitialSplit = true
            splitView.setPosition(splitView.bounds.height - 150, ofDividerAt: 0)
        }
    }

    public override func viewDidAppear() {
        super.viewDidAppear()
        view.window?.makeFirstResponder(searchField)
        // NSSearchField swallows Escape (to clear itself) before it reaches the
        // Cancel button's key equivalent, so catch it at the window here.
        escapeMonitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { [weak self] event in
            guard let self, event.window === self.view.window, event.keyCode == 53 else { return event }
            self.cancelAction()
            return nil
        }
    }

    public override func viewWillDisappear() {
        super.viewWillDisappear()
        if let escapeMonitor {
            NSEvent.removeMonitor(escapeMonitor)
            self.escapeMonitor = nil
        }
    }

    // MARK: - Subview configuration

    private func configureSearchField() {
        searchField.placeholderString = "Filter providers"
        searchField.delegate = self
        searchField.sendsWholeSearchString = false
        searchField.sendsSearchStringImmediately = true
    }

    private func configureTable() {
        tableView.headerView = NSTableHeaderView()
        tableView.rowHeight = 24
        tableView.usesAlternatingRowBackgroundColors = false
        tableView.allowsEmptySelection = false
        tableView.allowsMultipleSelection = false
        tableView.selectionHighlightStyle = .regular
        tableView.dataSource = self
        tableView.delegate = self
        tableView.target = self
        tableView.doubleAction = #selector(chooseAction)

        let nameColumn = NSTableColumn(identifier: Self.nameColumnID)
        nameColumn.title = "Provider"
        nameColumn.width = 320
        nameColumn.minWidth = 160
        nameColumn.resizingMask = .userResizingMask

        let typeColumn = NSTableColumn(identifier: Self.typeColumnID)
        typeColumn.title = "Configuration Type"
        typeColumn.width = 360
        typeColumn.minWidth = 160
        typeColumn.resizingMask = .autoresizingMask

        tableView.addTableColumn(nameColumn)
        tableView.addTableColumn(typeColumn)

        tableScroll.documentView = tableView
        tableScroll.hasVerticalScroller = true
        tableScroll.autohidesScrollers = true
        tableScroll.borderType = .noBorder
        tableScroll.drawsBackground = true
    }

    private func configureInfo() {
        infoTextView.isEditable = false
        infoTextView.isSelectable = true
        infoTextView.drawsBackground = true
        infoTextView.textContainerInset = NSSize(width: 8, height: 8)
        infoTextView.isVerticallyResizable = true
        infoTextView.textContainer?.widthTracksTextView = true

        infoScroll.documentView = infoTextView
        infoScroll.hasVerticalScroller = true
        infoScroll.autohidesScrollers = true
        infoScroll.borderType = .noBorder
        infoScroll.drawsBackground = true
    }

    private func configureSplit() {
        splitView.isVertical = false          // horizontal divider → top/bottom panes
        splitView.dividerStyle = .thin
        splitView.delegate = self
        splitView.addArrangedSubview(tableScroll)
        splitView.addArrangedSubview(infoScroll)
    }

    private func configureButtons() {
        cancelButton.title = "Cancel"
        cancelButton.bezelStyle = .rounded
        cancelButton.setButtonType(.momentaryPushIn)
        cancelButton.keyEquivalent = "\u{1b}"          // Escape
        cancelButton.target = self
        cancelButton.action = #selector(cancelAction)

        chooseButton.title = "Choose"
        chooseButton.bezelStyle = .rounded
        chooseButton.setButtonType(.momentaryPushIn)
        chooseButton.keyEquivalent = "\r"              // Return
        chooseButton.target = self
        chooseButton.action = #selector(chooseAction)
    }

    // MARK: - Selection & filtering

    private func reloadTable() {
        tableView.reloadData()
        chooseButton.isEnabled = !filteredRows.isEmpty
    }

    private func selectRow(_ index: Int) {
        guard !filteredRows.isEmpty else {
            updateInfo(for: nil)
            return
        }
        let clamped = max(0, min(filteredRows.count - 1, index))
        tableView.selectRowIndexes([clamped], byExtendingSelection: false)
        tableView.scrollRowToVisible(clamped)
        updateInfo(for: filteredRows[clamped])
    }

    private func moveSelection(by delta: Int) {
        guard !filteredRows.isEmpty else { return }
        let current = tableView.selectedRow < 0 ? 0 : tableView.selectedRow
        let next = max(0, min(filteredRows.count - 1, current + delta))
        selectRow(next)
        // Per spec: arrowing mirrors the highlighted provider into the filter
        // field. A programmatic stringValue set does not fire controlTextDidChange,
        // so this never re-filters the list out from under the selection.
        searchField.stringValue = filteredRows[next].providerName
    }

    private func applyFilter() {
        filteredRows = ProviderPickerFilter.filter(allRows, query: searchField.stringValue)
        reloadTable()
        selectRow(0)
    }

    private func updateInfo(for row: ProviderPickerRow?) {
        let palette = ThemePaletteObserver.currentPalette
        infoTextView.string = row.map(Self.infoText(for:)) ?? ""
        infoTextView.textColor = palette.primaryTextColor
        infoTextView.font = .systemFont(ofSize: NSFont.systemFontSize)
    }

    private static func infoText(for row: ProviderPickerRow) -> String {
        let template = row.available.template
        var lines = [template.displayName, "Configuration type: \(row.configType)"]
        if !template.models.isEmpty {
            lines.append("Models: \(template.models.joined(separator: ", "))")
        }
        if !template.resolvedDefaultModel.isEmpty {
            lines.append("Default model: \(template.resolvedDefaultModel)")
        }
        lines.append(template.secretRequired ? "Requires an API key." : "No API key required.")
        if let baseURL = template.defaultValues["baseURL"], !baseURL.isEmpty {
            lines.append("Base URL: \(baseURL)")
        }
        return lines.joined(separator: "\n")
    }

    // MARK: - Actions

    @objc private func chooseAction() {
        let row = tableView.selectedRow
        guard row >= 0, row < filteredRows.count else { return }
        completion?(filteredRows[row].available)
    }

    @objc private func cancelAction() {
        completion?(nil)
    }

    public override func cancelOperation(_ sender: Any?) {
        cancelAction()
    }

    // MARK: - Theme

    public func applyTheme(_ palette: SemanticPalette) {
        view.layer?.backgroundColor = palette.windowBackgroundColor.cgColor

        tableView.backgroundColor = palette.surfaceColor
        tableScroll.backgroundColor = palette.surfaceColor

        infoTextView.backgroundColor = palette.surfaceColor
        infoScroll.backgroundColor = palette.surfaceColor

        updateInfo(for: currentRow())
        tableView.reloadData()
    }

    private func currentRow() -> ProviderPickerRow? {
        let row = tableView.selectedRow
        guard row >= 0, row < filteredRows.count else { return nil }
        return filteredRows[row]
    }
}

// MARK: - Table data source / delegate

extension ProviderPickerViewController: NSTableViewDataSource, NSTableViewDelegate {

    public func numberOfRows(in tableView: NSTableView) -> Int { filteredRows.count }

    public func tableView(_ tableView: NSTableView,
                          viewFor tableColumn: NSTableColumn?, row: Int) -> NSView? {
        guard row >= 0, row < filteredRows.count, let column = tableColumn else { return nil }
        let palette = ThemePaletteObserver.currentPalette
        let entry = filteredRows[row]
        let isName = column.identifier == Self.nameColumnID
        let text = isName ? entry.providerName : entry.configType
        let color = isName ? palette.primaryTextColor : palette.secondaryTextColor
        return cell(for: column.identifier, text: text, color: color)
    }

    public func tableView(_ tableView: NSTableView, rowViewForRow row: Int) -> NSTableRowView? {
        ThemedTableRowView(frame: .zero)
    }

    public func tableViewSelectionDidChange(_ notification: Notification) {
        updateInfo(for: currentRow())
    }

    private func cell(for id: NSUserInterfaceItemIdentifier, text: String, color: NSColor) -> NSTableCellView {
        let cell = tableView.makeView(withIdentifier: id, owner: nil) as? NSTableCellView ?? {
            let view = NSTableCellView()
            view.identifier = id
            let field = NSTextField(labelWithString: "")
            field.translatesAutoresizingMaskIntoConstraints = false
            field.lineBreakMode = .byTruncatingTail
            field.font = .systemFont(ofSize: NSFont.systemFontSize)
            view.addSubview(field)
            view.textField = field
            NSLayoutConstraint.activate([
                field.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 4),
                field.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -4),
                field.centerYAnchor.constraint(equalTo: view.centerYAnchor)
            ])
            return view
        }()
        cell.textField?.stringValue = text
        cell.textField?.textColor = color
        return cell
    }
}

// MARK: - Search field delegate (keyboard)

extension ProviderPickerViewController: NSSearchFieldDelegate {

    public func controlTextDidChange(_ obj: Notification) {
        applyFilter()
    }

    public func control(_ control: NSControl, textView: NSTextView,
                        doCommandBy commandSelector: Selector) -> Bool {
        switch commandSelector {
        case #selector(NSResponder.moveDown(_:)):
            moveSelection(by: 1); return true
        case #selector(NSResponder.moveUp(_:)):
            moveSelection(by: -1); return true
        case #selector(NSResponder.insertNewline(_:)):
            chooseAction(); return true
        case #selector(NSResponder.cancelOperation(_:)):
            cancelAction(); return true
        default:
            return false
        }
    }
}

// MARK: - Split view (min pane sizes)

extension ProviderPickerViewController: NSSplitViewDelegate {

    public func splitView(_ splitView: NSSplitView,
                          constrainMinCoordinate proposedMin: CGFloat,
                          ofSubviewAt dividerIndex: Int) -> CGFloat {
        120   // minimum table height
    }

    public func splitView(_ splitView: NSSplitView,
                          constrainMaxCoordinate proposedMax: CGFloat,
                          ofSubviewAt dividerIndex: Int) -> CGFloat {
        max(120, splitView.bounds.height - 80)   // keep at least 80pt for the info pane
    }
}

// MARK: - Presenter

/// Presents ``ProviderPickerViewController`` as a resizable sheet over a parent
/// window and reports the chosen template.
@MainActor
public enum ProviderPicker {
    public static func present(
        over parent: NSWindow,
        rows: [ProviderPickerRow],
        onChoose: @escaping (AIPluginManager.AvailableProviderTemplate) -> Void
    ) {
        let controller = ProviderPickerViewController(rows: rows)
        let window = NSWindow(contentViewController: controller)
        window.styleMask = [.titled, .closable, .resizable]
        window.title = "Add a Provider"
        window.setContentSize(controller.preferredContentSize)
        window.minSize = NSSize(width: 480, height: 360)
        controller.completion = { [weak parent, weak window] result in
            guard let window else { return }
            parent?.endSheet(window)
            if let result { onChoose(result) }
        }
        parent.beginSheet(window)
    }
}
