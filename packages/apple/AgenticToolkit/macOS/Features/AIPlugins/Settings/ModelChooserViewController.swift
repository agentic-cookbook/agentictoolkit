import AppKit
import AgenticToolkitCore
import AIPluginKit

public struct ModelChooserContext {
    public let pluginIdentifier: String
    public let template: AIPluginDescriptor.ProviderTemplate
    public let baseURL: String
    public let apiKey: String?
    public let currentModel: String
    /// Memory-guard thresholds (% of RAM) for the fit line and warn prompt. Hosts
    /// that store overrides pass them; the defaults match `ModelFitPolicy`'s.
    public let warnPct: Int
    public let blockPct: Int
    public init(pluginIdentifier: String, template: AIPluginDescriptor.ProviderTemplate,
                baseURL: String, apiKey: String?, currentModel: String,
                warnPct: Int = ModelFitPolicy.defaultWarnPct,
                blockPct: Int = ModelFitPolicy.defaultBlockPct) {
        self.pluginIdentifier = pluginIdentifier
        self.template = template
        self.baseURL = baseURL
        self.apiKey = apiKey
        self.currentModel = currentModel
        self.warnPct = warnPct
        self.blockPct = blockPct
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
    /// model id -> ollama.com page blurb, for models without a curated one.
    private var descriptionsByModel: [String: String] = [:]
    /// model id -> on-disk size bytes, from Ollama's native `/api/tags` (loopback
    /// providers only). Feeds the memory-fit line and the warn-tier confirmation.
    private var sizesByModel: [String: Int] = [:]
    /// Same RAM source as the guard (`SystemMemoryMonitor`), so the chooser's fit
    /// labels can never disagree with what the daemon enforces.
    private let physicalRAM = SystemMemoryMonitor.shared.physicalRAM

    private let searchField = NSSearchField()
    private let tableView = NSTableView()
    private let tableScroll = NSScrollView()
    /// Canonical composable-settings scroll host: top-anchored, width pinned to
    /// the viewport so rebuilt detail content can never tug the split divider.
    private let detailScroll = ComposableSettings.PanelScrollView()
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
        // The table keeps its width when the window resizes; the detail pane
        // absorbs the change. (Indices only exist once both panes are added.)
        splitView.setHoldingPriority(NSLayoutConstraint.Priority(261), forSubviewAt: 0)
        splitView.setHoldingPriority(NSLayoutConstraint.Priority(260), forSubviewAt: 1)

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

    private func configureSplit() {
        splitView.isVertical = true           // vertical divider → left/right panes
        splitView.dividerStyle = .thin
        splitView.delegate = self             // min/max pane floors while dragging
        splitView.autosaveName = "model-chooser.split"   // divider position persists
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
        // Seed last-known sizes and metadata SYNCHRONOUSLY so the first render
        // (and OK/Return/double-click during the live-fetch window) sees them;
        // the fetches below overwrite (stale-while-revalidate).
        sizesByModel = LocalProviderModelStore.cachedSizes(baseURL: context.baseURL)
        metadataByModel = LocalProviderModelStore.cachedMetadata(baseURL: context.baseURL)
        descriptionsByModel = LocalProviderModelStore.cachedDescriptions()
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
    /// selected model. The catalog and size fetches hit independent endpoints, so
    /// they run concurrently — the worst case is the slower of the two, not the sum.
    private func loadLiveModels() async {
        let supportsLive = ModelChooserContent.supportsLiveModels(pluginIdentifier: context.pluginIdentifier)
        let isLocal = LocalProviderModelStore.isLocal(baseURL: context.baseURL)
        let baseURL = context.baseURL
        let apiKey = context.apiKey
        async let liveList: [String] = supportsLive
            ? OpenAIModelCatalog.fetch(baseURL: baseURL, apiKey: apiKey)
            : []
        async let liveSizes: [String: Int]? = isLocal
            ? LocalProviderModelStore.fetchSizes(baseURL: baseURL)
            : nil
        let live = await liveList
        if supportsLive, !live.isEmpty {
            let listed = ModelChooserContent.offeredModels(listed: live, current: selectedModel)
            items = listed.map { Self.item(for: $0, template: context.template) }
            applyFilter()
        }
        if isLocal {
            sizesByModel = await liveSizes
                ?? LocalProviderModelStore.cachedSizes(baseURL: context.baseURL)
            renderDetail()
        }
        refreshAllModelInfo()
    }

    /// Re-fetch `/api/show` metadata AND the ollama.com page description for
    /// EVERY listed model on every open (local providers only) — the caches
    /// painted the details instantly; the live data overwrites them and
    /// re-renders whenever the selected model's row lands. One independent task
    /// per fetch, so a slow model or a slow ollama.com can't delay the others.
    private func refreshAllModelInfo() {
        guard LocalProviderModelStore.isLocal(baseURL: context.baseURL) else { return }
        let baseURL = context.baseURL
        for model in items.map(\.id) where !model.isEmpty {
            Task { [weak self] in
                guard let meta = await LocalProviderModelStore.fetchMetadata(
                    baseURL: baseURL, model: model) else { return }
                guard let self else { return }
                self.metadataByModel[model] = meta
                if self.selectedModel == model { self.renderDetail() }
            }
            Task { [weak self] in
                guard let text = await LocalProviderModelStore.fetchDescription(model: model) else {
                    return
                }
                guard let self else { return }
                self.descriptionsByModel[model] = text
                if self.selectedModel == model { self.renderDetail() }
            }
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
    }

    /// Rebuild the detail pane for the selected model from `ModelChooserContent`
    /// + any loaded metadata, as a composable-settings panel (standard insets and
    /// spacing) headed by the model name.
    private func renderDetail() {
        let panel = ComposableSettings.PanelView()
        defer { detailScroll.setContent(panel) }
        guard let item = filtered.first(where: { $0.id == selectedModel })
            ?? items.first(where: { $0.id == selectedModel }) else { return }
        let meta = metadataByModel[selectedModel]

        let group = ComposableSettings.GroupView(
            withHeaderView: Self.wrappingLabel(item.id, role: .primaryText, textRole: .heading))
        let badges = ModelChooserContent.capabilityBadges(item: item, metadata: meta)
        let parts = badges.map { "\($0) ✓" } + [ModelChooserContent.specLine(meta)].compactMap { $0 }
        if !parts.isEmpty {
            group.addSettingSubview(Self.wrappingLabel(
                parts.joined(separator: " · "), role: .secondaryText, textRole: .caption))
        }
        let size = LocalModelServer.size(of: item.id, in: sizesByModel)
        if let fit = ModelChooserContent.fitLine(
            sizeBytes: size, physicalRAM: physicalRAM,
            warnPct: context.warnPct, blockPct: context.blockPct) {
            let role: ThemeRole = fit.tier == .block ? .danger : fit.tier == .warn ? .warning : .secondaryText
            group.addSettingSubview(Self.wrappingLabel(fit.text, role: role, textRole: .caption))
        }
        group.addSettingSubview(Self.wrappingLabel(
            ModelChooserContent.descriptionText(item: item, fetched: descriptionsByModel[item.id]),
            role: .primaryText, textRole: .body))
        panel.addGroup(group)
    }

    /// A themed label configured like `ComposableSettings.ExplanationView`'s: it
    /// wraps to the available width and yields horizontally, so a long line can
    /// never push the detail pane (or the divider) wider.
    private static func wrappingLabel(
        _ string: String, role: ThemeRole, textRole: TextRole
    ) -> ThemedLabel {
        let label = ThemedLabel(string: string, role: role, textRole: textRole)
        label.lineBreakMode = .byWordWrapping
        label.maximumNumberOfLines = 0
        label.setContentCompressionResistancePriority(.required, for: .vertical)
        label.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        label.setContentHuggingPriority(.defaultLow, for: .horizontal)
        return label
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
        cancelButton.bezelColor = palette.nsColor(.elevatedSurface)
        cancelButton.contentTintColor = palette.primaryTextColor
        renderDetail()   // ThemedLabels/PanelView re-theme themselves; rebuild to be safe
        tableView.reloadData()
    }

    @objc private func chooseTapped() {
        guard !selectedModel.isEmpty else { finish(with: nil); return }
        let size = LocalModelServer.size(of: selectedModel, in: sizesByModel)
        if let prompt = ModelChooserContent.warnPrompt(
            model: selectedModel, sizeBytes: size, physicalRAM: physicalRAM,
            warnPct: context.warnPct, blockPct: context.blockPct),
           !confirmLargeModel(prompt) {
            return   // Cancel: stay in the chooser, selection unchanged.
        }
        finish(with: selectedModel)
    }

    @objc private func cancelTapped() {
        finish(with: nil)
    }

    private func finish(with model: String?) {
        let done = completion
        completion = nil
        done?(model)
    }

    /// One confirmation before accepting a warn-tier selection. Block-tier models
    /// stay selectable with no dialog — the daemon refuses them at inference time
    /// and the fit line already reads "won't run".
    private func confirmLargeModel(_ informativeText: String) -> Bool {
        let alert = NSAlert()
        alert.messageText = "Large model"
        alert.informativeText = informativeText
        alert.alertStyle = .warning
        alert.addButton(withTitle: "Use Model")
        alert.addButton(withTitle: "Cancel")
        return alert.runModal() == .alertFirstButtonReturn
    }
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

// MARK: - Split view (min pane sizes while dragging)

extension ModelChooserViewController: NSSplitViewDelegate {

    public func splitView(_ splitView: NSSplitView,
                          constrainMinCoordinate proposedMin: CGFloat,
                          ofSubviewAt dividerIndex: Int) -> CGFloat {
        200   // never shrink the model list into uselessness
    }

    public func splitView(_ splitView: NSSplitView,
                          constrainMaxCoordinate proposedMax: CGFloat,
                          ofSubviewAt dividerIndex: Int) -> CGFloat {
        max(200, splitView.bounds.width - 240)   // keep at least 240pt for the details pane
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
