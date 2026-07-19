import AppKit
import AgenticToolkitCore
import AIPluginKit

public struct ModelChooserContext {
    public let pluginIdentifier: String
    public let template: AIPluginDescriptor.ProviderTemplate
    public let baseURL: String
    public let apiKey: String?
    public let currentModel: String
    public init(pluginIdentifier: String, template: AIPluginDescriptor.ProviderTemplate,
                baseURL: String, apiKey: String?, currentModel: String) {
        self.pluginIdentifier = pluginIdentifier
        self.template = template
        self.baseURL = baseURL
        self.apiKey = apiKey
        self.currentModel = currentModel
    }
}

/// App-modal, resizable master/detail picker for one provider's model. Mirrors
/// `ProviderPickerViewController` (filterable table master + details pane) but the
/// detail is per-model capability/spec/description, sourced live from Ollama's
/// `/api/show` for loopback providers and from curated `modelDetails` otherwise.
@MainActor
public final class ModelChooserViewController: NSViewController {

    static let windowID = "model-chooser"

    private let context: ModelChooserContext
    private var items: [ModelPickerItem]
    private var filtered: [ModelPickerItem]
    private var selectedModel: String
    private var metadataByModel: [String: OllamaModelMetadata] = [:]

    private let searchField = NSSearchField()
    private let tableView = NSTableView()
    private let tableScroll = NSScrollView()
    private let detailStack = NSStackView()   // themed labels, rebuilt per selection
    private let detailScroll = NSScrollView()
    private let splitView = NSSplitView()
    private let cancelButton = NSButton()
    private let okButton = NSButton()
    private let keyboard = PickerKeyboardController()
    private var themeObserver: ThemePaletteObserver?

    private static let nameColumnID = NSUserInterfaceItemIdentifier("model.name")

    /// Fires once with the chosen model (OK) or nil (Cancel/close).
    var completion: ((String?) -> Void)?

    var initialContentSize: NSSize { NSSize(width: 720, height: 460) }

    public init(context: ModelChooserContext) {
        self.context = context
        // Seed from the template (curated) immediately; live list/metadata replace it.
        let listed = ModelChooserContent.offeredModels(
            listed: context.template.models, current: context.currentModel)
        self.items = listed.map { Self.item(for: $0, template: context.template) }
        self.filtered = items
        self.selectedModel = context.currentModel
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    public required init?(coder: NSCoder) { fatalError() }

    private static func item(for model: String, template: AIPluginDescriptor.ProviderTemplate) -> ModelPickerItem {
        let detail = template.modelDetail(for: model)
        return ModelPickerItem(
            id: model, description: detail?.description, tools: detail?.tools, goodFor: detail?.goodFor)
    }

    // MARK: - View tree

    public override func loadView() {
        let root = NSView()
        root.wantsLayer = true

        configureSearchField()
        configureTable()
        configureDetail()
        configureSplit()
        configureButtons()

        let container = NSView()
        container.translatesAutoresizingMaskIntoConstraints = false
        [searchField, tableScroll].forEach {
            $0.translatesAutoresizingMaskIntoConstraints = false
            container.addSubview($0)
        }
        NSLayoutConstraint.activate([
            searchField.topAnchor.constraint(equalTo: container.topAnchor),
            searchField.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            searchField.trailingAnchor.constraint(equalTo: container.trailingAnchor),

            tableScroll.topAnchor.constraint(equalTo: searchField.bottomAnchor, constant: 8),
            tableScroll.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            tableScroll.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            tableScroll.bottomAnchor.constraint(equalTo: container.bottomAnchor)
        ])

        splitView.addArrangedSubview(container)     // left: search + table
        splitView.addArrangedSubview(detailScroll)   // right: details

        [splitView, cancelButton, okButton].forEach {
            $0.translatesAutoresizingMaskIntoConstraints = false
            root.addSubview($0)
        }

        NSLayoutConstraint.activate([
            splitView.topAnchor.constraint(equalTo: root.topAnchor, constant: 16),
            splitView.leadingAnchor.constraint(equalTo: root.leadingAnchor, constant: 16),
            splitView.trailingAnchor.constraint(equalTo: root.trailingAnchor, constant: -16),
            splitView.bottomAnchor.constraint(equalTo: cancelButton.topAnchor, constant: -10),

            okButton.trailingAnchor.constraint(equalTo: root.trailingAnchor, constant: -16),
            okButton.bottomAnchor.constraint(equalTo: root.bottomAnchor, constant: -16),
            cancelButton.trailingAnchor.constraint(equalTo: okButton.leadingAnchor, constant: -10),
            cancelButton.centerYAnchor.constraint(equalTo: okButton.centerYAnchor)
        ])

        self.view = root
        themeObserver = ThemePaletteObserver { [weak self] palette in self?.applyTheme(palette) }
    }

    private func configureSearchField() {
        searchField.placeholderString = "Filter models"
        searchField.delegate = self
        searchField.sendsWholeSearchString = false
        searchField.sendsSearchStringImmediately = true
    }

    private func configureTable() {
        tableView.headerView = nil
        tableView.rowHeight = 24
        tableView.usesAlternatingRowBackgroundColors = false
        tableView.allowsEmptySelection = false
        tableView.allowsMultipleSelection = false
        tableView.selectionHighlightStyle = .regular
        tableView.dataSource = self
        tableView.delegate = self
        tableView.target = self
        tableView.doubleAction = #selector(chooseTapped)
        tableView.columnAutoresizingStyle = .firstColumnOnlyAutoresizingStyle

        let nameColumn = NSTableColumn(identifier: Self.nameColumnID)
        nameColumn.title = "Model"
        nameColumn.width = 220
        nameColumn.minWidth = 80
        nameColumn.resizingMask = .autoresizingMask
        tableView.addTableColumn(nameColumn)

        tableScroll.documentView = tableView
        tableScroll.hasVerticalScroller = true
        tableScroll.autohidesScrollers = true
        tableScroll.borderType = .noBorder
        tableScroll.drawsBackground = true
    }

    private func configureDetail() {
        detailStack.orientation = .vertical
        detailStack.alignment = .leading
        detailStack.spacing = 6
        detailStack.edgeInsets = NSEdgeInsets(top: 8, left: 8, bottom: 8, right: 8)
        detailStack.translatesAutoresizingMaskIntoConstraints = false

        let clipView = NSView()
        clipView.translatesAutoresizingMaskIntoConstraints = false
        clipView.addSubview(detailStack)
        NSLayoutConstraint.activate([
            detailStack.topAnchor.constraint(equalTo: clipView.topAnchor),
            detailStack.leadingAnchor.constraint(equalTo: clipView.leadingAnchor),
            detailStack.trailingAnchor.constraint(equalTo: clipView.trailingAnchor),
            detailStack.bottomAnchor.constraint(lessThanOrEqualTo: clipView.bottomAnchor)
        ])

        detailScroll.documentView = clipView
        detailScroll.hasVerticalScroller = true
        detailScroll.autohidesScrollers = true
        detailScroll.borderType = .noBorder
        detailScroll.drawsBackground = true

        // Keep the document's width pinned to the scroll view's clip width so the
        // labels wrap instead of growing horizontally.
        NSLayoutConstraint.activate([
            clipView.widthAnchor.constraint(equalTo: detailScroll.contentView.widthAnchor)
        ])
    }

    private func configureSplit() {
        splitView.isVertical = true           // vertical divider → left/right panes
        splitView.dividerStyle = .thin
    }

    private func configureButtons() {
        cancelButton.title = "Cancel"
        cancelButton.bezelStyle = .rounded
        cancelButton.setButtonType(.momentaryPushIn)
        cancelButton.keyEquivalent = "\u{1b}"          // Escape
        cancelButton.target = self
        cancelButton.action = #selector(cancelTapped)

        okButton.title = "OK"
        okButton.bezelStyle = .rounded
        okButton.setButtonType(.momentaryPushIn)
        okButton.keyEquivalent = "\r"                  // Return
        okButton.target = self
        okButton.action = #selector(chooseTapped)
    }

    public override func viewDidLoad() {
        super.viewDidLoad()
        themeObserver = ThemePaletteObserver { [weak self] palette in self?.applyTheme(palette) }
        keyboard.onMoveSelection = { [weak self] delta in self?.moveSelection(by: delta) }
        keyboard.onChoose = { [weak self] in self?.chooseTapped() }
        keyboard.onCancel = { [weak self] in self?.cancelTapped() }
        tableView.doubleAction = #selector(chooseTapped)
        tableView.target = self
        selectRow(filtered.firstIndex { $0.id == selectedModel } ?? 0)
        Task { await loadLiveModels() }
    }

    public override func viewDidAppear() {
        super.viewDidAppear()
        view.window?.makeFirstResponder(searchField)
        keyboard.startEscapeMonitor(for: view.window)
    }
    public override func viewWillDisappear() {
        super.viewWillDisappear()
        keyboard.stopEscapeMonitor()
    }

    /// Replace the seeded list with the provider's live `/models` (for OpenAI-shaped
    /// providers), always keeping the current selection; then load metadata for the
    /// selected model.
    private func loadLiveModels() async {
        if ModelChooserContent.supportsLiveModels(pluginIdentifier: context.pluginIdentifier) {
            let live = await OpenAIModelCatalog.fetch(baseURL: context.baseURL, apiKey: context.apiKey)
            if !live.isEmpty {
                let listed = ModelChooserContent.offeredModels(listed: live, current: selectedModel)
                items = listed.map { Self.item(for: $0, template: context.template) }
                applyFilter()
            }
        }
        await loadMetadata(for: selectedModel)
    }

    /// Fetch `/api/show` metadata for a model (loopback only), cache it in-session,
    /// and refresh the detail pane if that model is still selected.
    private func loadMetadata(for model: String) async {
        guard !model.isEmpty, metadataByModel[model] == nil,
              LocalModelMetadataStore.isLoopback(baseURL: context.baseURL) else { return }
        if let meta = await LocalModelMetadataStore.fetch(openAIBaseURL: context.baseURL, model: model) {
            metadataByModel[model] = meta
            if selectedModel == model { renderDetail() }
        }
    }

    private func moveSelection(by delta: Int) {
        guard !filtered.isEmpty else { return }
        let idx = (filtered.firstIndex { $0.id == selectedModel } ?? 0) + delta
        selectRow(max(0, min(filtered.count - 1, idx)))
    }

    private func selectRow(_ index: Int) {
        guard filtered.indices.contains(index) else { renderDetail(); return }
        selectedModel = filtered[index].id
        tableView.selectRowIndexes([index], byExtendingSelection: false)
        tableView.scrollRowToVisible(index)
        renderDetail()
        Task { await loadMetadata(for: selectedModel) }
    }

    /// Rebuild the detail pane (ThemedLabels) for the selected model from
    /// `ModelChooserContent` + any loaded metadata.
    private func renderDetail() {
        detailStack.arrangedSubviews.forEach { $0.removeFromSuperview() }
        guard let item = filtered.first(where: { $0.id == selectedModel })
            ?? items.first(where: { $0.id == selectedModel }) else { return }
        let meta = metadataByModel[selectedModel]
        let title = ThemedLabel(string: item.id, role: .primaryText, textRole: .heading)
        detailStack.addArrangedSubview(title)
        let badges = ModelChooserContent.capabilityBadges(item: item, metadata: meta)
        if let spec = ModelChooserContent.specLine(meta) ?? (badges.isEmpty ? nil : "") {
            let line = ([badges.map { "\($0) ✓" }.joined(separator: " · "), spec]
                .filter { !$0.isEmpty }).joined(separator: " · ")
            detailStack.addArrangedSubview(ThemedLabel(string: line, role: .secondaryText, textRole: .caption))
        } else if !badges.isEmpty {
            detailStack.addArrangedSubview(ThemedLabel(
                string: badges.map { "\($0) ✓" }.joined(separator: " · "),
                role: .secondaryText, textRole: .caption))
        }
        let desc = ThemedLabel(string: ModelChooserContent.descriptionText(item: item),
                               role: .primaryText, textRole: .body)
        desc.lineBreakMode = .byWordWrapping
        desc.maximumNumberOfLines = 0
        detailStack.addArrangedSubview(desc)
    }

    private func applyFilter() {
        let needle = searchField.stringValue.trimmingCharacters(in: .whitespaces).lowercased()
        filtered = needle.isEmpty ? items : items.filter { $0.matches(needle) }
        tableView.reloadData()
        selectRow(filtered.firstIndex { $0.id == selectedModel } ?? 0)
    }

    private func applyTheme(_ palette: SemanticPalette) {
        view.layer?.backgroundColor = palette.windowBackgroundColor.cgColor
        tableView.backgroundColor = palette.surfaceColor
        tableScroll.backgroundColor = palette.surfaceColor
        detailScroll.backgroundColor = palette.surfaceColor
        cancelButton.bezelColor = palette.nsColor(.elevatedSurface)
        cancelButton.contentTintColor = palette.primaryTextColor
        renderDetail()   // ThemedLabels re-theme themselves; rebuild to be safe
        tableView.reloadData()
    }

    @objc private func chooseTapped() { completion?(selectedModel.isEmpty ? nil : selectedModel) }
    @objc private func cancelTapped() { completion?(nil) }
}

extension ModelChooserViewController: NSTableViewDataSource, NSTableViewDelegate {
    public func numberOfRows(in tableView: NSTableView) -> Int { filtered.count }

    public func tableView(_ tableView: NSTableView,
                          viewFor tableColumn: NSTableColumn?, row: Int) -> NSView? {
        guard row >= 0, row < filtered.count else { return nil }
        let identifier = NSUserInterfaceItemIdentifier("model.cell")
        let cell = tableView.makeView(withIdentifier: identifier, owner: nil) as? NSTableCellView ?? {
            let view = NSTableCellView()
            view.identifier = identifier
            let label = ThemedLabel(role: .primaryText, textRole: .body)
            label.translatesAutoresizingMaskIntoConstraints = false
            label.lineBreakMode = .byTruncatingTail
            view.addSubview(label)
            view.textField = label
            NSLayoutConstraint.activate([
                label.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 4),
                label.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -4),
                label.centerYAnchor.constraint(equalTo: view.centerYAnchor)
            ])
            return view
        }()
        cell.textField?.stringValue = filtered[row].id
        return cell
    }

    public func tableView(_ tableView: NSTableView, rowViewForRow row: Int) -> NSTableRowView? {
        ThemedTableRowView(frame: .zero)
    }

    public func tableViewSelectionDidChange(_ notification: Notification) {
        if tableView.selectedRow >= 0 { selectRow(tableView.selectedRow) }
    }
}

extension ModelChooserViewController: NSSearchFieldDelegate {
    public func controlTextDidChange(_ obj: Notification) { applyFilter() }
    public func control(_ control: NSControl, textView: NSTextView,
                        doCommandBy commandSelector: Selector) -> Bool {
        keyboard.handle(commandSelector)
    }
}

// MARK: - Window delegate (close = cancel, persist frame)

extension ModelChooserViewController: NSWindowDelegate {
    public func windowShouldClose(_ sender: NSWindow) -> Bool {
        cancelTapped()   // routes through completion → dismiss; don't let AppKit also close
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

/// Presents `ModelChooserViewController` app-modally in a resizable window and
/// reports the chosen model. Mirrors `ProviderPicker.present`.
@MainActor
public enum ModelChooser {
    public static func present(over parent: NSWindow, context: ModelChooserContext,
                               onChoose: @escaping (String) -> Void) {
        let controller = ModelChooserViewController(context: context)
        let window = NSWindow(contentViewController: controller)
        window.styleMask = [.titled, .closable, .resizable]
        window.title = "Choose Model"
        let background = ThemePaletteObserver.currentPalette.windowBackgroundColor
        let isDark = (background.usingColorSpace(.sRGB)?.brightnessComponent ?? 0.5) < 0.5
        window.appearance = NSAppearance(named: isDark ? .darkAqua : .aqua)
        window.contentMinSize = NSSize(width: 560, height: 340)
        window.contentMaxSize = NSSize(width: 4000, height: 4000)
        window.setContentSize(controller.initialContentSize)
        if !WindowManager.shared.frames.restoreFrame(for: window, id: ModelChooserViewController.windowID) {
            let size = window.frame.size
            window.setFrameOrigin(NSPoint(x: parent.frame.midX - size.width / 2,
                                          y: parent.frame.midY - size.height / 2))
        }
        window.delegate = controller
        var chosen: String?
        controller.completion = { [weak window] result in
            chosen = result
            window?.orderOut(nil)
            NSApp.stopModal()
        }
        NSApp.runModal(for: window)
        if let chosen { onChoose(chosen) }
    }
}
