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
    /// model id -> ollama.com page popularity (downloads + last update).
    private var pageStatsByModel: [String: LocalProviderModelStore.LocalModelPageStats] = [:]
    /// model id -> Artificial Analysis leaderboard entry (empty without a key).
    private var ranksByModel: [String: ArtificialAnalysisStore.ModelRank] = [:]
    /// model id -> on-disk size bytes, from Ollama's native `/api/tags` (loopback
    /// providers only). Feeds the memory-fit line and the warn-tier confirmation.
    private var sizesByModel: [String: Int] = [:]
    /// Same RAM source as the guard (`SystemMemoryMonitor`), so the chooser's fit
    /// labels can never disagree with what the daemon enforces.
    private let physicalRAM = SystemMemoryMonitor.shared.physicalRAM

    private let searchField = NSSearchField()
    private let useFilter = MultiChoiceFilterButton(
        label: "Good for",
        choices: ModelUseFacet.allCases.map { .init(id: $0.rawValue, title: $0.title, detail: $0.detail) })
    /// "Fits this Mac". Only local servers report a model's size, so only there can
    /// this box mean anything — elsewhere it isn't built (see `configureFilterBar`).
    private static let fitFilterTitle = "Fits this Mac"
    private let fitCheckbox = NSButton(checkboxWithTitle: fitFilterTitle, target: nil, action: nil)
    private let tableView = ThemedTableView()
    private let tableScroll = NSScrollView()
    /// Canonical composable-settings scroll host: top-anchored, width pinned to
    /// the viewport so rebuilt detail content can never tug the split divider.
    private let detailScroll = ComposableSettings.PanelScrollView()
    private let splitView = ThemedSplitView()
    private let cancelButton = NSButton()
    private let okButton = NSButton()
    private let keyboard = PickerKeyboardController()
    private var themeObserver: ThemePaletteObserver?

    private static let nameColumnID = NSUserInterfaceItemIdentifier("model.name")

    /// Fires once with the chosen model (OK) or nil (Cancel/close).
    var completion: ((String?) -> Void)?

    /// Taller than the pre-filter-bar 460 by exactly the bar it gained, so the
    /// detail pane opens at the height it always did.
    var initialContentSize: NSSize { NSSize(width: 720, height: 494) }

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

    /// Everything known about `model` at this provider: the shared catalog's
    /// description/capabilities, this template's context window and prices, and
    /// any curated `modelDetails` copy (which wins).
    private static func item(for model: String, template: AIPluginDescriptor.ProviderTemplate) -> ModelPickerItem {
        ModelPickerItem(id: model, info: AIModelCatalog.shared.resolve(model: model, template: template))
    }

    // MARK: - View tree

    public override func loadView() {
        let root = NSView()
        root.wantsLayer = true

        configureSearchField()
        configureFilterBar()
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

        [useFilter, fitCheckbox, splitView, cancelButton, okButton].forEach {
            $0.translatesAutoresizingMaskIntoConstraints = false
            root.addSubview($0)
        }

        NSLayoutConstraint.activate([
            // The filter row spans the whole window rather than sitting in the left
            // pane with the search field: the pull-down's summary title is wider
            // than the model table, and squeezing it would truncate the one part of
            // the control that says what is filtered.
            //
            // Each control is constrained directly rather than arranged in an
            // NSStackView. This window is opened from a SwiftUI button action
            // (`LLMProvidersView.presentChooser`) and enters `runModal` from inside
            // it; a control nested in a stack view here never gets its first
            // display pass — it is in the accessibility tree, at the right frame,
            // hit-testable, and blank until something else forces it to redraw,
            // while its stack view's own layer paints fine. Direct subviews of the
            // content view draw normally (as Cancel/OK next door always have).
            useFilter.topAnchor.constraint(equalTo: root.topAnchor, constant: 16),
            useFilter.leadingAnchor.constraint(equalTo: root.leadingAnchor, constant: 16),
            fitCheckbox.leadingAnchor.constraint(equalTo: useFilter.trailingAnchor, constant: 12),
            fitCheckbox.centerYAnchor.constraint(equalTo: useFilter.centerYAnchor),
            fitCheckbox.trailingAnchor.constraint(lessThanOrEqualTo: root.trailingAnchor, constant: -16),

            splitView.topAnchor.constraint(equalTo: useFilter.bottomAnchor, constant: 8),
            splitView.leadingAnchor.constraint(equalTo: root.leadingAnchor, constant: 16),
            splitView.trailingAnchor.constraint(equalTo: root.trailingAnchor, constant: -16),
            splitView.bottomAnchor.constraint(equalTo: cancelButton.topAnchor, constant: -10),

            okButton.trailingAnchor.constraint(equalTo: root.trailingAnchor, constant: -16),
            okButton.bottomAnchor.constraint(equalTo: root.bottomAnchor, constant: -16),
            cancelButton.trailingAnchor.constraint(equalTo: okButton.leadingAnchor, constant: -10),
            cancelButton.centerYAnchor.constraint(equalTo: okButton.centerYAnchor),
            // Cancel is drawn by the theme rather than by a stock bezel (see
            // `applySecondaryActionTheme`), so its size is stated here — matching
            // the default button beside it — instead of coming from the bezel.
            cancelButton.heightAnchor.constraint(equalTo: okButton.heightAnchor),
            cancelButton.widthAnchor.constraint(greaterThanOrEqualToConstant: 72)
        ])

        self.view = root
    }

    /// The filter row above the split: what the model is good for, and — for a local
    /// server only — whether it fits in this machine's RAM.
    ///
    /// There is no *type* filter here, unlike the provider picker: a chooser is
    /// opened on one already-chosen provider, so every model in it has that
    /// provider's single type and the control could only ever show or empty the
    /// whole list. The fit box takes that slot, and is the type question's local
    /// half — "will this actually run here".
    private func configureFilterBar() {
        useFilter.onChange = { [weak self] _ in self?.applyFilter() }
        fitCheckbox.target = self
        fitCheckbox.action = #selector(fitFilterToggled)
        fitCheckbox.toolTip = "Hide models too large for this Mac's "
            + "\(ModelFitPolicy.gbString(Int(physicalRAM))) of memory"
        // Only a local server reports a model's size, so only there can the box
        // mean anything; elsewhere it is present but never shown.
        fitCheckbox.isHidden = !LocalProviderModelStore.isLocal(baseURL: context.baseURL)
    }

    @objc private func fitFilterToggled() { applyFilter() }

    private func configureSearchField() {
        searchField.placeholderString = "Filter models"
        searchField.delegate = self
        searchField.sendsWholeSearchString = false
        searchField.sendsSearchStringImmediately = true
    }

    private func configureTable() {
        tableView.headerView = nil
        tableView.rowHeight = 24
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
        // Escape is handled once, via PickerKeyboardController's window monitor
        // (see `viewDidAppear`) — mirroring ProviderPicker, so no key equivalent here.
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
        pageStatsByModel = LocalProviderModelStore.cachedPageStats()
        ranksByModel = ArtificialAnalysisStore.cachedRanks()
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
            reapplyFilterIfDataDriven()
        }
        refreshAllModelInfo()
    }

    /// Re-fetch `/api/show` metadata (local providers) AND the live description
    /// + popularity + rank sources for EVERY listed model on every open — the
    /// caches painted the details instantly; the LIVE data overwrites them and
    /// re-renders whenever the selected model's row lands. One independent task
    /// per fetch, so a slow model or a slow catalog can't delay the others; the
    /// shared sources (catalogs, leaderboard) are single-flighted inside their
    /// stores so N tasks still mean one live round each.
    private func refreshAllModelInfo() {
        let isLocal = LocalProviderModelStore.isLocal(baseURL: context.baseURL)
        let baseURL = context.baseURL
        for model in items.map(\.id) where !model.isEmpty {
            if isLocal {
                Task { [weak self] in
                    guard let meta = await LocalProviderModelStore.fetchMetadata(
                        baseURL: baseURL, model: model) else { return }
                    guard let self else { return }
                    self.metadataByModel[model] = meta
                    if self.selectedModel == model { self.renderDetail() }
                }
            }
            Task { [weak self] in
                let info = await LocalProviderModelStore.fetchModelInfo(
                    model: model, viaOllamaPage: isLocal)
                guard let self else { return }
                var changed = false
                if let text = info.description {
                    descriptionsByModel[model] = text
                    changed = true
                    // A blurb is where a local model's facets come from.
                    reapplyFilterIfDataDriven()
                }
                if let stats = info.stats { pageStatsByModel[model] = stats; changed = true }
                if let rank = info.rank { ranksByModel[model] = rank; changed = true }
                if changed, selectedModel == model { renderDetail() }
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
        // Context window / output limit / token prices — this provider's terms, not
        // the model's own, so they sit apart from the capability badges above.
        if let facts = ModelChooserContent.factsLine(item.info) {
            group.addSettingSubview(Self.wrappingLabel(facts, role: .tertiaryText, textRole: .caption))
        }
        let size = LocalModelServer.size(of: item.id, in: sizesByModel)
        if let fit = ModelChooserContent.fitLine(
            sizeBytes: size, physicalRAM: physicalRAM,
            warnPct: context.warnPct, blockPct: context.blockPct) {
            let role: ThemeRole = fit.tier == .block ? .danger : fit.tier == .warn ? .warning : .secondaryText
            group.addSettingSubview(Self.wrappingLabel(fit.text, role: role, textRole: .caption))
        }
        if let popularity = ModelChooserContent.popularityLine(pageStatsByModel[item.id]) {
            group.addSettingSubview(Self.wrappingLabel(
                popularity, role: .secondaryText, textRole: .caption))
        }
        if let rank = ModelChooserContent.rankLine(ranksByModel[item.id]) {
            group.addSettingSubview(Self.wrappingLabel(
                rank, role: .secondaryText, textRole: .caption))
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
        filtered = ModelChooserContent.filter(
            items,
            query: searchField.stringValue,
            uses: Set(useFilter.selection.compactMap(ModelUseFacet.init(rawValue:))),
            descriptions: descriptionsByModel,
            fit: fitCheckbox.state == .on
                ? .init(sizes: sizesByModel, physicalRAM: physicalRAM,
                        warnPct: context.warnPct, blockPct: context.blockPct)
                : nil,
            keeping: selectedModel)
        tableView.reloadData()
        selectRow(filtered.firstIndex { $0.id == selectedModel } ?? 0)
    }

    /// Re-run the filter when late-arriving data would change its answer — sizes
    /// and blurbs land per model, seconds after the list does, and a filter set
    /// before they arrived would otherwise keep judging models on nothing. Skipped
    /// when neither filter is on, so the common case doesn't reload the table once
    /// per fetch.
    private func reapplyFilterIfDataDriven() {
        guard !useFilter.selection.isEmpty || fitCheckbox.state == .on else { return }
        applyFilter()
    }

    private func applyTheme(_ palette: SemanticPalette) {
        view.layer?.backgroundColor = palette.windowBackgroundColor.cgColor
        // The table is a `ThemedTableView` and paints its own `.surface`; only
        // its scroll host needs matching here.
        tableScroll.backgroundColor = palette.surfaceColor
        // Cancel is painted explicitly: AppKit's stock bezel composites away to
        // nothing in this window (see `applySecondaryActionTheme`).
        cancelButton.applySecondaryActionTheme(palette)
        // A checkbox's title takes the system label color, not the theme's.
        fitCheckbox.attributedTitle = NSAttributedString(string: Self.fitFilterTitle, attributes: [
            .foregroundColor: palette.primaryTextColor,
            .font: palette.font(.body)
        ])
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
        window.appearance = ThemePaletteObserver.currentPalette.standardAppearance
        window.backgroundColor = ThemePaletteObserver.currentPalette.windowBackgroundColor
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
