import AppKit
import AIPluginKit
import AgenticToolkitCore
import AgenticToolkitCoreMacOS

/// One selectable row in the provider picker, split into three clear columns:
/// the vendor (Provider), the model brand (LLM), and the auth method (Config
/// Type) — read from the template's descriptor metadata.
public struct ProviderPickerRow: Equatable, Sendable {
    public let available: AIPluginManager.AvailableProviderTemplate

    /// What this provider's models are collectively good for — the union over every
    /// model it lists, because the question a filter answers here is "could I do X
    /// at this provider", not "is every model at it good at X".
    ///
    /// Resolved once, at init: it costs a catalog lookup per listed model, and the
    /// filter re-runs on every keystroke. Providers whose models are only known at
    /// runtime (local servers) contribute an empty set, which the filter reads as
    /// "unknown" rather than "none" — see `ModelUseFacet.matches`.
    public let uses: Set<ModelUseFacet>

    public init(available: AIPluginManager.AvailableProviderTemplate) {
        self.available = available
        let template = available.template
        self.uses = template.models.reduce(into: Set<ModelUseFacet>()) { found, model in
            found.formUnion(
                ModelUseFacet.facets(for: AIModelCatalog.shared.resolve(model: model, template: template)))
        }
    }

    /// Vendor / service — the Provider column (e.g. "Anthropic", "Google").
    public var provider: String { available.template.resolvedProvider }
    /// Model brand — the LLM column (e.g. "Claude", "Gemini", "GPT").
    public var llm: String { available.template.resolvedLLM }
    /// Auth method — the Config Type column (e.g. "API Key", "OAuth Account").
    public var configType: String { available.template.resolvedConfigType }
    /// What it takes to use this provider — the Config Type, bucketed for filtering.
    public var type: ProviderTypeFacet { ProviderTypeFacet(configType: configType) }
}

/// Pure, testable filter over provider rows: a substring over the three columns,
/// narrowed by what the provider's models are good for and by what it takes to set
/// it up. The three are independent — a row must survive all of them.
public enum ProviderPickerFilter {
    public static func filter(_ rows: [ProviderPickerRow], query: String,
                              uses: Set<ModelUseFacet> = [],
                              types: Set<ProviderTypeFacet> = []) -> [ProviderPickerRow] {
        let needle = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return rows.filter { row in
            guard ModelUseFacet.matches(facets: row.uses, selected: uses),
                  ProviderTypeFacet.matches(type: row.type, selected: types) else { return false }
            guard !needle.isEmpty else { return true }
            return row.provider.lowercased().contains(needle)
                || row.llm.lowercased().contains(needle)
                || row.configType.lowercased().contains(needle)
        }
    }
}

/// Modal provider picker (presented via ``ProviderPicker/present(over:rows:onChoose:)``).
///
/// One filter row on top — the filter field, then the "Good for" and "Type"
/// pull-downs pushed to the trailing edge — over a draggable vertical split whose
/// two halves each stack a table above its own description pane:
///
/// ```
///          Providers            |          Models
/// [Provider / LLM / Type table] | [Model + capability check marks]
/// ------------------------------|-------------------------------
/// [provider description]        | [model description]
/// ```
///
/// Cancel / Choose sit below. Fully keyboard-driven: up/down move the provider
/// selection and mirror it into the filter field, Return chooses, Escape cancels.
/// Themed via the toolkit palette; shown as an app-modal resizable window.
@MainActor
public final class ProviderPickerViewController: NSViewController, Themeable {

    /// Called with the chosen template, or `nil` on cancel. Set by the presenter.
    public var completion: ((AIPluginManager.AvailableProviderTemplate?) -> Void)?

    private let allRows: [ProviderPickerRow]
    private var filteredRows: [ProviderPickerRow]
    /// The selected provider's models, resolved against the catalog once per
    /// selection — the capability columns ask each row four questions, and the
    /// table asks for a cell per column per visible row.
    private var modelRows: [ModelRow] = []

    /// Column widths fitted to the content (measured once from `allRows`).
    private let columnWidths: [NSUserInterfaceItemIdentifier: CGFloat]
    /// Natural width of the provider table (sum of fitted columns), used to size the
    /// window and place the initial split divider.
    private let tableWidth: CGFloat
    /// Natural width of the models table — the Model column plus one check-mark
    /// column per capability. Sizes the right half of the window.
    private let modelTableWidth: CGFloat
    /// The window's initial content size. Not `preferredContentSize`: setting that on
    /// a window's contentViewController pins the window's min == max size, defeating
    /// `.resizable`.
    public let initialContentSize: NSSize

    private let searchField = NSSearchField()
    private let useFilter = MultiChoiceFilterButton(
        label: "Good for",
        choices: ModelUseFacet.allCases.map { .init(id: $0.rawValue, title: $0.title, detail: $0.detail) })
    private let typeFilter = MultiChoiceFilterButton(
        label: "Type",
        choices: ProviderTypeFacet.allCases.map { .init(id: $0.rawValue, title: $0.title, detail: $0.detail) })
    private let filterBar = NSStackView()

    private let providerTitle = NSTextField(labelWithString: "Providers")
    private let tableView = ThemedTableView()
    private let tableScroll = NSScrollView()
    private let infoTextView = NSTextView()
    private let infoScroll = NSScrollView()
    private let providerSplit = ThemedSplitView()

    private let modelTitle = NSTextField(labelWithString: "Models")
    private let modelTableView = ThemedTableView()
    private let modelTableScroll = NSScrollView()
    private let modelInfoTextView = NSTextView()
    private let modelInfoScroll = NSScrollView()
    private let modelSplit = ThemedSplitView()

    private let splitView = ThemedSplitView()
    private let cancelButton = NSButton()
    private let chooseButton = NSButton()

    private var themeObserver: ThemePaletteObserver?
    private var didSetInitialSplit = false
    private var didSetInitialInnerSplits = false
    /// Set while this controller drives a table's selection itself, so the resulting
    /// `tableViewSelectionDidChange` doesn't redo the work the setter already did.
    /// The explicit calls stay (AppKit posts nothing when the selection is unchanged
    /// — `applyFilter` re-selecting row 0 while already on row 0), so without this
    /// flag every programmatic selection did its work twice, including a second
    /// rebuild of the models table.
    private var isSelectingProgrammatically = false
    /// `cacheKey(for:)` of the provider the models table was last built for, so
    /// `reloadModels` can tell "same provider, list refreshed" (keep the user's
    /// model selection) from "different provider" (land on the first model).
    private var modelsKey: String?
    /// Is the field's text a mirrored selection (`moveSelection`) rather than a typed
    /// query? A mirrored name must never be filtered ON: arrowing to "Anthropic" and
    /// then picking a "Good for" facet would otherwise narrow the list to Anthropic,
    /// as if the user had typed it.
    private var queryIsMirroredSelection = false
    private let keyboard = PickerKeyboardController()

    /// Live model lists fetched for OpenAI-shaped (local/compatible) providers,
    /// keyed by `cacheKey(for:)` — plugin identifier + template id. The
    /// OpenAI-compatible plugin exposes many templates (Ollama, Groq, DeepSeek,
    /// xAI, …) under one shared plugin identifier, each its own picker row;
    /// keying by plugin identifier alone would let one template's live models
    /// leak into every sibling template's row. Populated lazily on selection so
    /// the models table shows the provider's real, current models instead of
    /// the static snapshot baked into the descriptor. Absent entries (remote
    /// providers, or a fetch still in flight / failed) fall back to
    /// `template.models` — see `resolvedModels(for:)`.
    private var liveModelsByTemplate: [String: [String]] = [:]

    /// Frame-persistence key, shared with the presenter, so the picker window's
    /// size + location go through the app's `WindowManager` like every other window.
    static let windowID = "provider-picker"

    /// Divider-position autosave names. `WindowManager` persists the window's
    /// frame, but AppKit owns divider positions — without these, every reopen threw
    /// away whatever pane layout the user had dragged out.
    private static let outerSplitAutosave = "provider-picker.outer"
    private static let providerSplitAutosave = "provider-picker.providers"
    private static let modelSplitAutosave = "provider-picker.models"

    /// The narrowest either half of the outer split may be squeezed to.
    private static let minPaneWidth: CGFloat = 200

    /// Has AppKit already restored autosaved divider positions for `name`?
    ///
    /// Probing the defaults key AppKit writes is the only way to ask — a restored
    /// split is indistinguishable from an unplaced one by the time `viewDidLayout`
    /// runs. If that key's format ever changes this reads false and the initial
    /// placement runs, which is the behavior from before autosave rather than a
    /// broken window.
    private static func hasAutosavedPositions(_ name: String) -> Bool {
        UserDefaults.standard.object(forKey: "NSSplitView Subview Frames \(name)") != nil
    }

    /// Where the outer divider may sit in a split of `width`: no narrower than the
    /// provider table's fitted columns, unless the window itself is too narrow to
    /// afford that plus a usable models half — and never so far right that the
    /// models half loses its own minimum.
    ///
    /// One computation because the two `constrain*Coordinate` callbacks have to
    /// agree. The pair they replace didn't: a fixed `tableWidth` minimum against a
    /// width-derived maximum handed AppKit a minimum above its maximum for any
    /// window narrower than `tableWidth + 240`, which the picker's own
    /// `contentMinSize` allows.
    ///
    /// A pure function of the three widths, so the ordering it promises can be
    /// tested without a window.
    static func outerDividerLimits(width: CGFloat, tableWidth: CGFloat,
                                   modelTableWidth: CGFloat) -> (min: CGFloat, max: CGFloat) {
        let upper = max(minPaneWidth, width - minPaneWidth)
        let lower = min(tableWidth, max(minPaneWidth, width - modelTableWidth))
        return (min(lower, upper), upper)
    }

    private func outerDividerLimits(width: CGFloat) -> (min: CGFloat, max: CGFloat) {
        Self.outerDividerLimits(width: width, tableWidth: tableWidth, modelTableWidth: modelTableWidth)
    }

    private static let providerColumnID = NSUserInterfaceItemIdentifier("provider.provider")
    private static let llmColumnID = NSUserInterfaceItemIdentifier("provider.llm")
    private static let typeColumnID = NSUserInterfaceItemIdentifier("provider.type")
    private static let modelColumnID = NSUserInterfaceItemIdentifier("model.name")

    /// A capability column's identifier, e.g. `model.capability.tools`.
    private static func capabilityColumnID(_ capability: ModelCapability) -> NSUserInterfaceItemIdentifier {
        NSUserInterfaceItemIdentifier("model.capability.\(capability.rawValue)")
    }

    /// The capability whose check-mark column carries `id`, or `nil` for any other
    /// column.
    private static func capability(for id: NSUserInterfaceItemIdentifier) -> ModelCapability? {
        ModelCapability.allCases.first { capabilityColumnID($0) == id }
    }

    /// The glyph a capability column renders — check or nothing, never a cross: the
    /// catalog reports what a model CAN do, so an absent capability is "not
    /// reported", which a ✗ would overstate as "cannot".
    private static let checkMark = "✓"

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
        let modelW = Self.modelNameColumnWidth
            + ModelCapability.allCases.reduce(0) { $0 + (widths[Self.capabilityColumnID($1)] ?? 60) }
            + CGFloat(ModelCapability.allCases.count) * 3 /* intercell */
            + 16 /* vertical scroller */ + 8 /* slack */
        self.modelTableWidth = modelW

        // Height for the provider table to show every row without scrolling — the
        // pane the window is sized around.
        //
        // The description panes are deliberately NOT measured: a provider serving a
        // hundred models renders thousands of points of text, so fitting the tallest
        // one asks for a window taller than any display (the screen clamps it, and
        // the measured number is thrown away). Laying out every provider's full pane
        // through Core Text just to compute that discarded number cost the whole
        // catalog — decode, resolve and typeset — before the picker could open. The
        // panes scroll.
        let listHeight = CGFloat(max(rows.count, 1)) * 24 + 28 /* header */ + 4

        let width = 16 + tableW + 8 /* divider gap */ + modelW + 16
        let height = 16 + 18 /* pane title */ + 4 + listHeight
            + 8 /* inner divider */ + 140 /* description pane */
            + 26 /* filter row */ + 8 + 10 + 32 /* buttons */ + 16
        self.initialContentSize = NSSize(width: width, height: height)
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    public required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    /// The font the table cells render in (must match `fittedColumnWidths`).
    /// Computed, not stored: the theme owns the font, so the column widths have to
    /// be measured in whichever one is active rather than one baked in at launch.
    private static var cellFont: NSFont { ThemePaletteObserver.currentPalette.font(.body) }

    /// The Model column's width. Fixed rather than fitted: the model list changes
    /// with every selection (and again when a live fetch lands), so a width measured
    /// from it would jitter as the user arrows down the provider list.
    private static let modelNameColumnWidth: CGFloat = 220

    /// Measures each column's widest value (and its header) to fit content + padding.
    /// The capability columns have no per-row text, so they fit their header alone.
    private static func fittedColumnWidths(for rows: [ProviderPickerRow])
        -> [NSUserInterfaceItemIdentifier: CGFloat] {
        let headerFont = ThemePaletteObserver.currentPalette.font(.caption, weight: .bold)
        func measure(_ string: String, _ withFont: NSFont) -> CGFloat {
            (string as NSString).size(withAttributes: [.font: withFont]).width
        }
        func fit(_ title: String, _ values: [String]) -> CGFloat {
            let widest = values.map { measure($0, cellFont) }.max() ?? 0
            // Generous padding: cell insets + breathing room + room to spare when the
            // vertical scroller appears and eats into the last column.
            return ceil(max(measure(title, headerFont), widest)) + 46
        }
        var widths: [NSUserInterfaceItemIdentifier: CGFloat] = [
            providerColumnID: fit("Provider", rows.map(\.provider)),
            llmColumnID: fit("LLM", rows.map(\.llm)),
            typeColumnID: fit("Config Type", rows.map(\.configType))
        ]
        for capability in ModelCapability.allCases {
            widths[capabilityColumnID(capability)] =
                ceil(max(measure(capability.title, headerFont), measure(checkMark, cellFont))) + 20
        }
        return widths
    }

    // MARK: - View tree

    public override func loadView() {
        let root = NSView()
        root.wantsLayer = true

        configureFilterBar()
        configureTable()
        configureModelTable()
        configureInfo()
        configureSplit()
        configureButtons()

        [filterBar, splitView, cancelButton, chooseButton].forEach {
            $0.translatesAutoresizingMaskIntoConstraints = false
            root.addSubview($0)
        }

        NSLayoutConstraint.activate([
            filterBar.topAnchor.constraint(equalTo: root.topAnchor, constant: 16),
            filterBar.leadingAnchor.constraint(equalTo: root.leadingAnchor, constant: 16),
            filterBar.trailingAnchor.constraint(equalTo: root.trailingAnchor, constant: -16),

            splitView.topAnchor.constraint(equalTo: filterBar.bottomAnchor, constant: 8),
            splitView.leadingAnchor.constraint(equalTo: root.leadingAnchor, constant: 16),
            splitView.trailingAnchor.constraint(equalTo: root.trailingAnchor, constant: -16),
            splitView.bottomAnchor.constraint(equalTo: cancelButton.topAnchor, constant: -10),

            chooseButton.trailingAnchor.constraint(equalTo: root.trailingAnchor, constant: -16),
            chooseButton.bottomAnchor.constraint(equalTo: root.bottomAnchor, constant: -16),
            cancelButton.trailingAnchor.constraint(equalTo: chooseButton.leadingAnchor, constant: -10),
            cancelButton.centerYAnchor.constraint(equalTo: chooseButton.centerYAnchor),
            // Cancel is drawn by the theme rather than by a stock bezel (see
            // `applySecondaryActionTheme`), so its size is stated here — matching
            // the default button beside it — instead of coming from the bezel.
            cancelButton.heightAnchor.constraint(equalTo: chooseButton.heightAnchor),
            cancelButton.widthAnchor.constraint(greaterThanOrEqualToConstant: 72)
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
        // Place each divider once, on the first layout pass that has a real size.
        // Latching on "has a size" rather than on a minimum size: a size gate stays
        // armed until the window happens to grow that big, which can be long after
        // the user has dragged the divider themselves — and firing then throws that
        // drag away. A first pass that is small merely places the divider inside a
        // small window, which is what the constraints are for.
        if !didSetInitialSplit, splitView.bounds.width > 0 {
            didSetInitialSplit = true
            if !Self.hasAutosavedPositions(Self.outerSplitAutosave) {
                // The table fits its columns; the models half gets the rest.
                let limits = outerDividerLimits(width: splitView.bounds.width)
                splitView.setPosition(min(max(tableWidth, limits.min), limits.max), ofDividerAt: 0)
            }
        }
        if !didSetInitialInnerSplits, providerSplit.bounds.height > 0, modelSplit.bounds.height > 0 {
            didSetInitialInnerSplits = true
            // Lists get the top ~60%, descriptions the rest — enough prose to read
            // without hiding the list that drives it.
            for (inner, name) in [(providerSplit, Self.providerSplitAutosave),
                                  (modelSplit, Self.modelSplitAutosave)]
            where !Self.hasAutosavedPositions(name) {
                inner.setPosition(inner.bounds.height * 0.6, ofDividerAt: 0)
            }
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

    /// The whole filter on one row: the field takes the slack, and the two
    /// pull-downs are pushed to the trailing edge. They narrow the same list the
    /// field does — what the provider's models are good for, and what it takes to
    /// set the provider up.
    private func configureFilterBar() {
        searchField.placeholderString = "Filter providers"
        searchField.delegate = self
        searchField.sendsWholeSearchString = false
        searchField.sendsSearchStringImmediately = true

        filterBar.orientation = .horizontal
        filterBar.spacing = 8
        filterBar.addView(searchField, in: .leading)
        filterBar.addView(useFilter, in: .trailing)
        filterBar.addView(typeFilter, in: .trailing)
        // Only the field grows; the pull-downs stay at their intrinsic width so the
        // gap between the two groups is the flexible space.
        filterBar.setHuggingPriority(.defaultLow, for: .horizontal)
        searchField.setContentHuggingPriority(.defaultLow, for: .horizontal)
        for button in [useFilter, typeFilter] {
            button.setContentHuggingPriority(.defaultHigh, for: .horizontal)
            button.setContentCompressionResistancePriority(.required, for: .horizontal)
        }
        searchField.widthAnchor.constraint(greaterThanOrEqualToConstant: 160).isActive = true
    }

    private func configureTable() {
        tableView.headerView = NSTableHeaderView()
        tableView.rowHeight = 24
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

        configureScroll(tableScroll, documentView: tableView)
    }

    /// The models the selected provider serves: the model name plus one check-mark
    /// column per ``ModelCapability``, so "which of these can call tools" is a
    /// glance down a column rather than a read through every blurb.
    private func configureModelTable() {
        modelTableView.headerView = NSTableHeaderView()
        modelTableView.rowHeight = 24
        modelTableView.allowsEmptySelection = true
        modelTableView.allowsMultipleSelection = false
        modelTableView.selectionHighlightStyle = .regular
        modelTableView.dataSource = self
        modelTableView.delegate = self
        modelTableView.columnAutoresizingStyle = .noColumnAutoresizing

        let nameColumn = NSTableColumn(identifier: Self.modelColumnID)
        nameColumn.title = "Model"
        nameColumn.width = Self.modelNameColumnWidth
        nameColumn.minWidth = 100
        nameColumn.resizingMask = .userResizingMask
        modelTableView.addTableColumn(nameColumn)

        for capability in ModelCapability.allCases {
            let column = NSTableColumn(identifier: Self.capabilityColumnID(capability))
            column.title = capability.title
            column.headerToolTip = capability.detail
            column.width = columnWidths[Self.capabilityColumnID(capability)] ?? 60
            column.minWidth = 40
            column.resizingMask = .userResizingMask
            modelTableView.addTableColumn(column)
        }

        configureScroll(modelTableScroll, documentView: modelTableView)
    }

    private func configureInfo() {
        for textView in [infoTextView, modelInfoTextView] {
            textView.isEditable = false
            textView.isSelectable = true
            textView.drawsBackground = true
            // Roomier than a table cell's padding: this is prose, and it reads as a
            // card rather than as a fourth column of the list above it.
            textView.textContainerInset = NSSize(width: 14, height: 12)
            // The full width-tracking recipe. `widthTracksTextView` alone is not
            // enough inside a scroll view: without the autoresizing mask the text
            // view keeps the width it was first laid out at, so dragging the split
            // wider left the prose wrapped to the old, narrower column — and the
            // unbounded container height is what lets it grow instead of clipping.
            textView.autoresizingMask = [.width]
            textView.isVerticallyResizable = true
            textView.isHorizontallyResizable = false
            textView.minSize = NSSize(width: 0, height: 0)
            textView.maxSize = NSSize(width: CGFloat.greatestFiniteMagnitude,
                                      height: CGFloat.greatestFiniteMagnitude)
            textView.textContainer?.widthTracksTextView = true
            textView.textContainer?.containerSize = NSSize(width: 0, height: CGFloat.greatestFiniteMagnitude)
        }
        configureScroll(infoScroll, documentView: infoTextView)
        configureScroll(modelInfoScroll, documentView: modelInfoTextView)
    }

    private func configureScroll(_ scroll: NSScrollView, documentView: NSView) {
        scroll.documentView = documentView
        scroll.hasVerticalScroller = true
        scroll.autohidesScrollers = true
        scroll.borderType = .noBorder
        scroll.drawsBackground = true
    }

    /// The outer vertical divider splits providers from models; each half is itself
    /// a horizontal split of a table over the description of whatever is selected in
    /// it. All three dividers are user-draggable.
    private func configureSplit() {
        for title in [providerTitle, modelTitle] {
            title.observeTheme { field, palette in
                field.font = palette.font(.caption, weight: .bold)
            }
            title.alignment = .center
        }

        providerSplit.isVertical = false          // horizontal divider → table over details
        providerSplit.dividerStyle = .thin
        providerSplit.delegate = self
        providerSplit.autosaveName = Self.providerSplitAutosave
        providerSplit.addArrangedSubview(tableScroll)
        providerSplit.addArrangedSubview(infoScroll)

        modelSplit.isVertical = false
        modelSplit.dividerStyle = .thin
        modelSplit.delegate = self
        modelSplit.autosaveName = Self.modelSplitAutosave
        modelSplit.addArrangedSubview(modelTableScroll)
        modelSplit.addArrangedSubview(modelInfoScroll)

        splitView.isVertical = true               // vertical divider → left/right halves
        splitView.dividerStyle = .thin
        splitView.delegate = self
        splitView.autosaveName = Self.outerSplitAutosave
        splitView.addArrangedSubview(titled(providerTitle, over: providerSplit))
        splitView.addArrangedSubview(titled(modelTitle, over: modelSplit))
    }

    /// A split-view half: its column heading over the pane it names.
    private func titled(_ title: NSTextField, over pane: NSView) -> NSView {
        let container = NSView()
        for subview in [title, pane] {
            subview.translatesAutoresizingMaskIntoConstraints = false
            container.addSubview(subview)
        }
        NSLayoutConstraint.activate([
            title.topAnchor.constraint(equalTo: container.topAnchor),
            title.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            title.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            pane.topAnchor.constraint(equalTo: title.bottomAnchor, constant: 4),
            pane.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            pane.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            pane.bottomAnchor.constraint(equalTo: container.bottomAnchor)
        ])
        return container
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
        // Drive the repaint from here rather than from the notification: AppKit
        // posts nothing when the selection doesn't actually move, and `applyFilter`
        // re-selecting row 0 while already on row 0 has to repaint a list that now
        // holds different providers. The flag stops the notification from doing the
        // same work a second time in the cases where it *is* posted.
        isSelectingProgrammatically = true
        tableView.selectRowIndexes([clamped], byExtendingSelection: false)
        isSelectingProgrammatically = false
        tableView.scrollRowToVisible(clamped)
        updateInfo(for: filteredRows[clamped])
        fetchLiveModelsIfNeeded(for: filteredRows[clamped])
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
        queryIsMirroredSelection = true
    }

    /// The text to filter on — nothing while the field is showing a mirrored selection.
    private var effectiveQuery: String { queryIsMirroredSelection ? "" : searchField.stringValue }

    private func applyFilter() {
        filteredRows = ProviderPickerFilter.filter(
            allRows,
            query: effectiveQuery,
            uses: Set(useFilter.selection.compactMap(ModelUseFacet.init(rawValue:))),
            types: Set(typeFilter.selection.compactMap(ProviderTypeFacet.init(rawValue:))))
        reloadTable()
        selectRow(0)
    }

    /// Repaints both description panes and refills the models table for `row`.
    private func updateInfo(for row: ProviderPickerRow?) {
        let palette = ThemePaletteObserver.currentPalette
        for textView in [infoTextView, modelInfoTextView] {
            textView.linkTextAttributes = [
                .foregroundColor: palette.accentColor,
                .underlineStyle: NSUnderlineStyle.single.rawValue,
                .cursor: NSCursor.pointingHand
            ]
        }
        let content = row.map { ProviderPickerInfo.provider($0, palette: palette) }
            ?? ProviderPickerInfo.placeholder("No provider matches these filters.", palette: palette)
        infoTextView.textStorage?.setAttributedString(content)
        reloadModels(for: row)
    }

    /// Rebuilds the models table for `row` (empty when nothing is selected) and
    /// lands on its first model so the model description pane is never blank while
    /// a provider with models is selected.
    ///
    /// A rebuild for the *same* provider keeps whichever model was selected. This is
    /// not cosmetic: a live model fetch landing (`fetchLiveModelsIfNeeded`) and a
    /// theme change both re-enter here, and either one used to yank the user back to
    /// the first model while they were reading the fifth.
    private func reloadModels(for row: ProviderPickerRow?) {
        let previousKey = modelsKey
        let previousModel = selectedModelName()
        if let row {
            let template = row.available.template
            modelsKey = cacheKey(for: row)
            modelRows = resolvedModels(for: row).map { model in
                ModelRow(name: model, info: AIModelCatalog.shared.resolve(model: model, template: template))
            }
        } else {
            modelsKey = nil
            modelRows = []
        }
        modelTableView.reloadData()
        guard !modelRows.isEmpty else {
            updateModelInfo(for: nil)
            return
        }
        // Same provider → keep the user's model if it survived the rebuild;
        // a different provider carries its own models, so land on the first.
        let keep = modelsKey == previousKey ? previousModel : nil
        let index = keep.flatMap { name in modelRows.firstIndex { $0.name == name } } ?? 0
        isSelectingProgrammatically = true
        modelTableView.selectRowIndexes([index], byExtendingSelection: false)
        isSelectingProgrammatically = false
        modelTableView.scrollRowToVisible(index)
        updateModelInfo(for: modelRows[index])
    }

    /// The name of the model highlighted in the models table, if any.
    private func selectedModelName() -> String? {
        let row = modelTableView.selectedRow
        guard row >= 0, row < modelRows.count else { return nil }
        return modelRows[row].name
    }

    private func updateModelInfo(for model: ModelRow?) {
        let palette = ThemePaletteObserver.currentPalette
        let content = model.map { ProviderPickerInfo.model(name: $0.name, info: $0.info, palette: palette) }
            ?? ProviderPickerInfo.placeholder(noModelText, palette: palette)
        modelInfoTextView.textStorage?.setAttributedString(content)
    }

    /// Why the model pane has nothing to describe. Three different reasons, and
    /// saying the wrong one is worse than saying nothing: a local server publishes
    /// its models only once it's running and configured, which is a different claim
    /// from "this provider has no models" — and neither is true when the table is
    /// full and the user has merely deselected (⌘-click clears the selection, since
    /// this table allows an empty one).
    private var noModelText: String {
        guard let row = currentRow() else { return "Select a provider to see the models it serves." }
        guard modelRows.isEmpty else { return "Select a model to see what it can do." }
        return ModelChooserContent.supportsLiveModels(pluginIdentifier: row.available.pluginIdentifier)
            ? "This provider lists its models once it's configured and reachable."
            : "This provider doesn't publish a model list."
    }

    /// Per-template cache key: plugin identifier + template id. The
    /// OpenAI-compatible plugin exposes many templates under one plugin
    /// identifier, each its own picker row, so the plugin identifier alone is
    /// not unique enough to key a live-model cache.
    private func cacheKey(for row: ProviderPickerRow) -> String {
        "\(row.available.pluginIdentifier)|\(row.available.template.id)"
    }

    /// The models to render for `row`: a live-fetched list if one is cached
    /// (local/OpenAI-compatible providers, once `fetchLiveModelsIfNeeded` has
    /// resolved), else the static snapshot baked into the descriptor.
    private func resolvedModels(for row: ProviderPickerRow) -> [String] {
        liveModelsByTemplate[cacheKey(for: row)] ?? row.available.template.models
    }

    /// Kicks an async fetch of the real, live model list for OpenAI-shaped
    /// providers (e.g. Ollama) so the models table stops showing the stale
    /// static snapshot baked into the descriptor. No-op for remote providers
    /// (`ModelChooserContent.supportsLiveModels` false), providers already
    /// cached, or providers with no configured base URL yet. On success,
    /// re-renders only if the fetched row is still selected.
    private func fetchLiveModelsIfNeeded(for row: ProviderPickerRow) {
        let id = row.available.pluginIdentifier
        let key = cacheKey(for: row)
        guard ModelChooserContent.supportsLiveModels(pluginIdentifier: id),
              liveModelsByTemplate[key] == nil else { return }
        let baseURL = row.available.template.defaultValues["baseURL"] ?? ""
        guard !baseURL.isEmpty else { return }
        Task { @MainActor in
            let models = await OpenAIModelCatalog.fetch(baseURL: baseURL, apiKey: nil)
            guard !models.isEmpty else { return }
            liveModelsByTemplate[key] = models
            if let cur = currentRow(), cacheKey(for: cur) == key { updateInfo(for: cur) }
        }
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

        // The tables are `ThemedTableView`s and paint their own `.surface`; only
        // their scroll hosts need matching here.
        for scroll in [tableScroll, modelTableScroll, infoScroll, modelInfoScroll] {
            scroll.backgroundColor = palette.surfaceColor
        }
        for textView in [infoTextView, modelInfoTextView] {
            textView.backgroundColor = palette.surfaceColor
        }
        for title in [providerTitle, modelTitle] {
            title.textColor = palette.secondaryTextColor
        }

        // The same explicit Cancel styling the chooser uses, so the two dialogs
        // agree — AppKit's stock bezel does not (see `applySecondaryActionTheme`).
        cancelButton.applySecondaryActionTheme(palette)

        updateInfo(for: currentRow())
        tableView.reloadData()
    }

    private func currentRow() -> ProviderPickerRow? {
        let row = tableView.selectedRow
        guard row >= 0, row < filteredRows.count else { return nil }
        return filteredRows[row]
    }
}

// MARK: - Nested types

extension ProviderPickerViewController {

    /// One row of the models table: the model's name plus the catalog metadata the
    /// capability columns and the description pane read.
    fileprivate struct ModelRow {
        let name: String
        let info: AIModelCatalog.ResolvedModel
    }
}

// MARK: - Table data source / delegate

extension ProviderPickerViewController: NSTableViewDataSource, NSTableViewDelegate {

    public func numberOfRows(in tableView: NSTableView) -> Int {
        tableView === modelTableView ? modelRows.count : filteredRows.count
    }

    public func tableView(_ tableView: NSTableView,
                          viewFor tableColumn: NSTableColumn?, row: Int) -> NSView? {
        guard let column = tableColumn else { return nil }
        let palette = ThemePaletteObserver.currentPalette
        if tableView === modelTableView {
            guard row >= 0, row < modelRows.count else { return nil }
            let entry = modelRows[row]
            if let capability = Self.capability(for: column.identifier) {
                return cell(in: tableView, for: column.identifier,
                            text: ModelCapability.has(capability, entry.info) ? Self.checkMark : "",
                            color: palette.accentColor, alignment: .center)
            }
            return cell(in: tableView, for: column.identifier,
                        text: entry.name, color: palette.primaryTextColor)
        }
        guard row >= 0, row < filteredRows.count else { return nil }
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
        return cell(in: tableView, for: column.identifier, text: text, color: color)
    }

    public func tableView(_ tableView: NSTableView, rowViewForRow row: Int) -> NSTableRowView? {
        ThemedTableRowView(frame: .zero)
    }

    public func tableViewSelectionDidChange(_ notification: Notification) {
        guard let table = notification.object as? NSTableView, !isSelectingProgrammatically else { return }
        if table === modelTableView {
            let row = modelTableView.selectedRow
            updateModelInfo(for: row >= 0 && row < modelRows.count ? modelRows[row] : nil)
            return
        }
        updateInfo(for: currentRow())
        if let row = currentRow() { fetchLiveModelsIfNeeded(for: row) }
    }

    /// A reusable label cell. `identifier` doubles as the reuse key, so a check-mark
    /// column never recycles a left-aligned name cell.
    private func cell(in tableView: NSTableView, for id: NSUserInterfaceItemIdentifier,
                      text: String, color: NSColor,
                      alignment: NSTextAlignment = .left) -> NSTableCellView {
        let cell = tableView.makeView(withIdentifier: id, owner: nil) as? NSTableCellView ?? {
            let view = NSTableCellView()
            view.identifier = id
            let field = NSTextField(labelWithString: "")
            field.translatesAutoresizingMaskIntoConstraints = false
            field.lineBreakMode = .byTruncatingTail
            field.alignment = alignment
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
        // Cells are pooled, so the font is reapplied per row alongside the color —
        // one baked in at creation would survive a theme swap unchanged.
        cell.textField?.font = Self.cellFont
        cell.textField?.textColor = color
        return cell
    }
}

// MARK: - Search field delegate (keyboard)

extension ProviderPickerViewController: NSSearchFieldDelegate {

    public func controlTextDidChange(_ obj: Notification) {
        queryIsMirroredSelection = false
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
        // Outer: keep both halves usable — see `outerDividerLimits`, which is where
        // the two bounds are computed together so they can't contradict each other.
        // Inner: always leave a couple of rows plus the header visible.
        splitView === self.splitView
            ? outerDividerLimits(width: splitView.bounds.width).min
            : 80
    }

    public func splitView(_ splitView: NSSplitView,
                          constrainMaxCoordinate proposedMax: CGFloat,
                          ofSubviewAt dividerIndex: Int) -> CGFloat {
        splitView === self.splitView
            ? outerDividerLimits(width: splitView.bounds.width).max
            : max(100, splitView.bounds.height - 60)   // keep a readable sliver of description
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
        window.appearance = ThemePaletteObserver.currentPalette.standardAppearance
        window.backgroundColor = ThemePaletteObserver.currentPalette.windowBackgroundColor
        window.contentMinSize = NSSize(width: 640, height: 380)
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
