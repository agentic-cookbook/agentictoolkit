import AppKit
import AIPluginKit
import AgenticToolkitCore
import AgenticToolkitCoreMacOS

/// One selectable row in the provider picker, split into three clear columns:
/// the vendor (Provider), the model brand (LLM), and the auth method (Config
/// Type) — read from the template's descriptor metadata.
public struct ProviderPickerRow: Equatable, Sendable {
    public let available: AIPluginManager.AvailableProviderTemplate

    public init(available: AIPluginManager.AvailableProviderTemplate) {
        self.available = available
    }

    /// Vendor / service — the Provider column (e.g. "Anthropic", "Google").
    public var provider: String { available.template.resolvedProvider }
    /// Model brand — the LLM column (e.g. "Claude", "Gemini", "GPT").
    public var llm: String { available.template.resolvedLLM }
    /// Auth method — the Config Type column (e.g. "API Key", "OAuth Account").
    public var configType: String { available.template.resolvedConfigType }
}

/// Pure, testable substring filter over provider rows (provider + LLM + config type).
public enum ProviderPickerFilter {
    public static func filter(_ rows: [ProviderPickerRow], query: String) -> [ProviderPickerRow] {
        let needle = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !needle.isEmpty else { return rows }
        return rows.filter {
            $0.provider.lowercased().contains(needle)
                || $0.llm.lowercased().contains(needle)
                || $0.configType.lowercased().contains(needle)
        }
    }
}

/// Modal provider picker (presented via ``ProviderPicker/present(over:rows:onChoose:)``).
///
/// A focused filter field on top; below it a draggable vertical split with a
/// three-column table (Provider / LLM / Config Type, sized to fit content) on the
/// left and a provider-details pane on the right; Cancel / Choose below. Fully
/// keyboard-driven: up/down move the selection and mirror it into the filter
/// field, Return chooses, Escape cancels. Themed via the toolkit palette; shown
/// as an app-modal resizable window.
@MainActor
public final class ProviderPickerViewController: NSViewController, Themeable {

    /// Called with the chosen template, or `nil` on cancel. Set by the presenter.
    public var completion: ((AIPluginManager.AvailableProviderTemplate?) -> Void)?

    private let allRows: [ProviderPickerRow]
    private var filteredRows: [ProviderPickerRow]

    /// Column widths fitted to the content (measured once from `allRows`).
    private let columnWidths: [NSUserInterfaceItemIdentifier: CGFloat]
    /// Natural width of the table (sum of fitted columns), used to size the window
    /// and place the initial split divider.
    private let tableWidth: CGFloat
    /// The window's initial content size. Not `preferredContentSize`: setting that on
    /// a window's contentViewController pins the window's min == max size, defeating
    /// `.resizable`.
    public let initialContentSize: NSSize

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
    private let keyboard = PickerKeyboardController()

    /// Frame-persistence key, shared with the presenter, so the picker window's
    /// size + location go through the app's `WindowManager` like every other window.
    static let windowID = "provider-picker"

    private static let providerColumnID = NSUserInterfaceItemIdentifier("provider.provider")
    private static let llmColumnID = NSUserInterfaceItemIdentifier("provider.llm")
    private static let typeColumnID = NSUserInterfaceItemIdentifier("provider.type")

    public init(rows: [ProviderPickerRow]) {
        self.allRows = rows
        self.filteredRows = rows
        let widths = Self.fittedColumnWidths(for: rows)
        self.columnWidths = widths
        let tableW = (widths[Self.providerColumnID] ?? 120)
            + (widths[Self.llmColumnID] ?? 90)
            + (widths[Self.typeColumnID] ?? 120)
            + 6 /* intercell */ + 16 /* vertical scroller */ + 8 /* slack */
        self.tableWidth = tableW

        let infoWidth: CGFloat = 400
        // Height for the table to show every row without scrolling.
        let tableHeight = CGFloat(max(rows.count, 1)) * 24 + 28 /* header */ + 4
        // Height for the tallest details pane (measured at infoWidth) without scrolling.
        let palette = ThemePaletteObserver.currentPalette
        let textWidth = infoWidth - 26 /* text-container insets + line padding */
        let detailsHeight = rows.map { row in
            Self.attributedInfo(for: row, palette: palette).boundingRect(
                with: NSSize(width: textWidth, height: .greatestFiniteMagnitude),
                options: [.usesLineFragmentOrigin, .usesFontLeading]).height
        }.max() ?? 0
        let paneHeight = max(tableHeight, ceil(detailsHeight) + 20 /* text insets */)

        let width = 16 + tableW + 8 /* divider gap */ + infoWidth + 16
        let height = 16 + 26 /* search */ + 8 + paneHeight + 10 + 32 /* buttons */ + 16
        self.initialContentSize = NSSize(width: width, height: height)
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    public required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    /// The font the table cells render in (must match `fittedColumnWidths`).
    private static let cellFont = NSFont.systemFont(ofSize: NSFont.systemFontSize)

    /// Measures each column's widest value (and its header) to fit content + padding.
    private static func fittedColumnWidths(for rows: [ProviderPickerRow])
        -> [NSUserInterfaceItemIdentifier: CGFloat] {
        let headerFont = NSFont.boldSystemFont(ofSize: 11)
        func measure(_ string: String, _ withFont: NSFont) -> CGFloat {
            (string as NSString).size(withAttributes: [.font: withFont]).width
        }
        func fit(_ title: String, _ values: [String]) -> CGFloat {
            let widest = values.map { measure($0, cellFont) }.max() ?? 0
            // Generous padding: cell insets + breathing room + room to spare when the
            // vertical scroller appears and eats into the last column.
            return ceil(max(measure(title, headerFont), widest)) + 46
        }
        return [
            providerColumnID: fit("Provider", rows.map(\.provider)),
            llmColumnID: fit("LLM", rows.map(\.llm)),
            typeColumnID: fit("Config Type", rows.map(\.configType))
        ]
    }

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
        // Wait until the split is actually wide enough before placing the divider,
        // so an early layout pass (window not yet at full width) doesn't clamp it.
        if !didSetInitialSplit, splitView.bounds.width >= tableWidth + 240 {
            didSetInitialSplit = true
            splitView.setPosition(tableWidth, ofDividerAt: 0)   // table fits its columns; info gets the rest
        }
    }

    public override func viewDidAppear() {
        super.viewDidAppear()
        view.window?.makeFirstResponder(searchField)
        keyboard.onMoveSelection = { [weak self] delta in self?.moveSelection(by: delta) }
        keyboard.onChoose = { [weak self] in self?.chooseAction() }
        keyboard.onCancel = { [weak self] in self?.cancelAction() }
        keyboard.startEscapeMonitor(for: view.window)
    }

    public override func viewWillDisappear() {
        super.viewWillDisappear()
        keyboard.stopEscapeMonitor()
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
        // Columns keep their content-fitted widths; never auto-squeezed (which
        // clipped the longest Config Type value).
        tableView.columnAutoresizingStyle = .noColumnAutoresizing

        let providerColumn = NSTableColumn(identifier: Self.providerColumnID)
        providerColumn.title = "Provider"
        providerColumn.width = columnWidths[Self.providerColumnID] ?? 200
        providerColumn.minWidth = 60
        providerColumn.resizingMask = .userResizingMask

        let llmColumn = NSTableColumn(identifier: Self.llmColumnID)
        llmColumn.title = "LLM"
        llmColumn.width = columnWidths[Self.llmColumnID] ?? 140
        llmColumn.minWidth = 50
        llmColumn.resizingMask = .userResizingMask

        let typeColumn = NSTableColumn(identifier: Self.typeColumnID)
        typeColumn.title = "Config Type"
        typeColumn.width = columnWidths[Self.typeColumnID] ?? 200
        typeColumn.minWidth = 80
        typeColumn.resizingMask = .userResizingMask

        tableView.addTableColumn(providerColumn)
        tableView.addTableColumn(llmColumn)
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
        splitView.isVertical = true           // vertical divider → left/right panes
        splitView.dividerStyle = .thin
        splitView.delegate = self
        splitView.addArrangedSubview(tableScroll)   // left: provider table
        splitView.addArrangedSubview(infoScroll)    // right: details
    }

    private func configureButtons() {
        cancelButton.title = "Cancel"
        cancelButton.bezelStyle = .rounded
        cancelButton.setButtonType(.momentaryPushIn)
        // Escape is handled once, via PickerKeyboardController's window monitor — the
        // search field would swallow a Cancel key-equivalent anyway.
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
        searchField.stringValue = filteredRows[next].provider
    }

    private func applyFilter() {
        filteredRows = ProviderPickerFilter.filter(allRows, query: searchField.stringValue)
        reloadTable()
        selectRow(0)
    }

    private func updateInfo(for row: ProviderPickerRow?) {
        let palette = ThemePaletteObserver.currentPalette
        infoTextView.linkTextAttributes = [
            .foregroundColor: palette.accentColor,
            .underlineStyle: NSUnderlineStyle.single.rawValue,
            .cursor: NSCursor.pointingHand
        ]
        let content = row.map { Self.attributedInfo(for: $0, palette: palette) }
            ?? NSAttributedString(string: "")
        infoTextView.textStorage?.setAttributedString(content)
    }

    /// A `location`-based tab stop so every label row's value starts at the same x,
    /// giving the details pane a fixed-width label column.
    private static let labelStyle: NSParagraphStyle = {
        let style = NSMutableParagraphStyle()
        style.tabStops = [NSTextTab(textAlignment: .left, location: 120)]
        style.defaultTabInterval = 120
        style.headIndent = 120
        style.paragraphSpacing = 2
        return style
    }()

    private static let wrapStyle: NSParagraphStyle = {
        let style = NSMutableParagraphStyle()
        style.paragraphSpacing = 4
        return style
    }()

    /// Builds the structured details pane for a provider: header, provider/LLM
    /// blurbs, an aligned label/value block (with a clickable base URL), and one
    /// line per model with its description / tool support / strengths when known.
    private static func attributedInfo(for row: ProviderPickerRow, palette: SemanticPalette) -> NSAttributedString {
        let primary = palette.primaryTextColor
        let secondary = palette.secondaryTextColor
        let tertiary = palette.nsColor(.tertiaryText)
        let accent = palette.accentColor
        let body = NSFont.systemFont(ofSize: 12)
        let caption = NSFont.systemFont(ofSize: 11)

        let out = NSMutableAttributedString()
        func add(_ string: String, _ font: NSFont, _ color: NSColor, _ paragraph: NSParagraphStyle? = nil) {
            var attrs: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: color]
            if let paragraph { attrs[.paragraphStyle] = paragraph }
            out.append(NSAttributedString(string: string, attributes: attrs))
        }
        func labelRow(_ label: String, _ value: String) {
            add("\(label)\t", body, secondary, labelStyle)
            add("\(value)\n", body, primary, labelStyle)
        }

        let template = row.available.template

        add((row.llm.isEmpty ? row.provider : "\(row.provider) · \(row.llm)") + "\n",
            NSFont.boldSystemFont(ofSize: 14), primary)
        if let text = template.providerDescription, !text.isEmpty { add(text + "\n", body, secondary, wrapStyle) }
        if let text = template.llmDescription, !text.isEmpty { add(text + "\n", body, secondary, wrapStyle) }
        add("\n", body, secondary)

        labelRow("Provider", row.provider)
        if !row.llm.isEmpty { labelRow("LLM", row.llm) }
        labelRow("Config Type", row.configType)
        if let url = template.defaultValues["baseURL"], !url.isEmpty {
            add("Base URL\t", body, secondary, labelStyle)
            var attrs: [NSAttributedString.Key: Any] = [
                .font: body, .foregroundColor: accent, .paragraphStyle: labelStyle,
                .underlineStyle: NSUnderlineStyle.single.rawValue
            ]
            if let link = URL(string: url) { attrs[.link] = link }
            out.append(NSAttributedString(string: url + "\n", attributes: attrs))
        }
        if !template.resolvedDefaultModel.isEmpty { labelRow("Default model", template.resolvedDefaultModel) }
        labelRow("API key", template.secretRequired ? "Required" : "Not required")

        if !template.models.isEmpty {
            add("\nModels\n", NSFont.boldSystemFont(ofSize: 12), primary)
            for model in template.models {
                add("  \(model)\n", NSFont.systemFont(ofSize: 12, weight: .semibold), primary)
                guard let detail = template.modelDetail(for: model) else { continue }
                if let text = detail.description, !text.isEmpty {
                    add("      \(text)\n", caption, secondary)
                }
                var caps: [String] = []
                if let tools = detail.tools { caps.append("Tools: \(tools ? "Yes" : "No")") }
                if let goodFor = detail.goodFor, !goodFor.isEmpty { caps.append("Good for: \(goodFor)") }
                if !caps.isEmpty { add("      \(caps.joined(separator: " · "))\n", caption, tertiary) }
            }
        }

        return out
    }

    // MARK: - Actions

    @objc private func chooseAction() {
        guard completion != nil else { return }
        let row = tableView.selectedRow
        guard row >= 0, row < filteredRows.count else { return }
        let done = completion
        completion = nil
        done?(filteredRows[row].available)
    }

    @objc private func cancelAction() {
        guard let done = completion else { return }
        completion = nil
        done(nil)
    }

    // MARK: - Theme

    public func applyTheme(_ palette: SemanticPalette) {
        view.layer?.backgroundColor = palette.windowBackgroundColor.cgColor

        tableView.backgroundColor = palette.surfaceColor
        tableScroll.backgroundColor = palette.surfaceColor

        infoTextView.backgroundColor = palette.surfaceColor
        infoScroll.backgroundColor = palette.surfaceColor

        // The default (Choose) button shows via its opaque accent fill, but a normal
        // button's bezel is semi-transparent and vanishes against the themed dark
        // background — give Cancel an opaque, theme-derived bezel so it stays visible.
        cancelButton.bezelColor = palette.nsColor(.elevatedSurface)
        cancelButton.contentTintColor = palette.primaryTextColor

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
        let text: String
        let color: NSColor
        switch column.identifier {
        case Self.providerColumnID:
            text = entry.provider; color = palette.primaryTextColor
        case Self.llmColumnID:
            text = entry.llm; color = palette.secondaryTextColor
        default:
            text = entry.configType; color = palette.secondaryTextColor
        }
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
            field.font = Self.cellFont
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
        keyboard.handle(commandSelector)
    }
}

// MARK: - Split view (min pane sizes)

extension ProviderPickerViewController: NSSplitViewDelegate {

    public func splitView(_ splitView: NSSplitView,
                          constrainMinCoordinate proposedMin: CGFloat,
                          ofSubviewAt dividerIndex: Int) -> CGFloat {
        tableWidth   // never shrink the table narrower than its fitted columns
    }

    public func splitView(_ splitView: NSSplitView,
                          constrainMaxCoordinate proposedMax: CGFloat,
                          ofSubviewAt dividerIndex: Int) -> CGFloat {
        max(200, splitView.bounds.width - 240)   // keep at least 240pt for the details pane
    }
}

// MARK: - Window delegate (close = cancel)

extension ProviderPickerViewController: NSWindowDelegate {
    public func windowShouldClose(_ sender: NSWindow) -> Bool {
        cancelAction()   // routes through completion → dismiss; don't let AppKit also close
        return false
    }

    // Persist size + location through the shared frame manager (like every other
    // window), rather than AppKit's raw frame autosave.
    public func windowDidMove(_ notification: Notification) { persistFrame(notification) }
    public func windowDidResize(_ notification: Notification) { persistFrame(notification) }

    private func persistFrame(_ notification: Notification) {
        guard let window = notification.object as? NSWindow else { return }
        WindowManager.shared.frames.saveFrame(for: window, id: Self.windowID)
    }
}

// MARK: - Presenter

/// Presents ``ProviderPickerViewController`` as an app-modal, **resizable** window
/// centered over a parent and reports the chosen template. A titled resizable
/// window is used (not a sheet) because sheets don't accept user resizing.
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
        // Force a STANDARD dark/light appearance (matched to the theme's background)
        // so standard AppKit controls render with proper contrast — a custom theme
        // appearance draws the non-default Cancel button's bezel invisibly.
        let background = ThemePaletteObserver.currentPalette.windowBackgroundColor
        let isDark = (background.usingColorSpace(.sRGB)?.brightnessComponent ?? 0.5) < 0.5
        window.appearance = NSAppearance(named: isDark ? .darkAqua : .aqua)
        window.contentMinSize = NSSize(width: 520, height: 320)
        window.contentMaxSize = NSSize(width: 4000, height: 4000)
        window.setContentSize(controller.initialContentSize)

        // Restore the user's saved size + location via the shared frame manager (the
        // controller's window delegate saves future moves/resizes). First time,
        // center over the parent.
        if !WindowManager.shared.frames.restoreFrame(for: window, id: ProviderPickerViewController.windowID) {
            let size = window.frame.size
            window.setFrameOrigin(NSPoint(
                x: parent.frame.midX - size.width / 2,
                y: parent.frame.midY - size.height / 2))
        }

        // Attach the delegate only AFTER the programmatic setContentSize + restore.
        // The delegate persists windowDidResize/Move through the frame manager, so
        // attaching it earlier would let the setContentSize above save the initial
        // content-fit size and clobber the user's saved frame before restoreFrame
        // reads it — the window would forget its size/position every reopen.
        window.delegate = controller

        var chosen: AIPluginManager.AvailableProviderTemplate?
        controller.completion = { [weak window] result in
            chosen = result
            window?.orderOut(nil)
            NSApp.stopModal()
        }
        NSApp.runModal(for: window)
        if let chosen { onChoose(chosen) }
    }
}
