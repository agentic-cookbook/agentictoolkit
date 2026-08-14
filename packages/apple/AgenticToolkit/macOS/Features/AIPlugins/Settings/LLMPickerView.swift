import AppKit
import AgenticToolkitCore
import AIPluginKit

/// The shared "which LLM runs this feature" control: a Provider popup over a Model
/// row, with their labels aligned in one column.
///
/// ```
/// Provider: [ Ollama            ⌄ ]
///    Model: llama3.2:3b          [ Choose… ]
/// ```
///
/// One picker serves every feature that needs a provider + model (session
/// summaries, oversight, and whatever comes next): it is parameterized by which
/// pref holds the *selection*, which sentinel choices lead the Provider popup
/// ("Default (Claude CLI)", "Same as AI Summaries", …), and which per-configuration
/// setting backs the Model row. It only edits settings — pushing them anywhere is
/// the host's business — so the same picker can appear in a settings panel and a
/// window's gear popover without the two fighting over who notifies whom.
///
/// The Model row is *always* present, including for sentinel selections that name
/// no configuration: hiding it made the panel jump and left "which model?" looking
/// unanswerable rather than not-applicable. With no configuration to choose for,
/// the row reads ``noProviderModelText`` and the Choose button is disabled.
///
/// Both the popup's contents and the model row rebuild live: adding, renaming or
/// removing a configuration in the LLM Providers panel is reflected without an app
/// relaunch (these pickers are long-lived, so a choice list built once in `init`
/// would go stale).
@MainActor
public final class LLMPickerView: NSView, SettingsViewProtocol {

    /// Shown in the model slot when the selection names no configuration to pick a
    /// model for — a sentinel provider, or a configuration whose plugin is gone.
    public static let noProviderModelText = "Use Choose button to set"

    /// A non-configuration entry that leads the Provider popup. `value` is what
    /// gets written to the selection pref, so the host's sentinel vocabulary
    /// ("" = inherit, "claude-cli" = the zero-config CLI path) stays the host's.
    public struct LeadingChoice: Sendable {
        public let label: String
        public let value: String

        public init(label: String, value: String) {
            self.label = label
            self.value = value
        }
    }

    private let providerLabel = NSTextField(labelWithString: "Provider")
    private let modelLabel = NSTextField(labelWithString: "Model")
    private let providerPopup = NSPopUpButton(frame: .zero, pullsDown: false)
    private let modelNameLabel = NSTextField(labelWithString: "")
    private let chooseButton = NSButton(title: "Choose…", target: nil, action: nil)

    private let pluginManager: AIPluginManager?
    private let selectedSetting: UserSetting<String>
    private let leadingChoices: [LeadingChoice]
    private let modelSetting: (UUID, AIPluginDescriptor.ProviderTemplate) -> UserSetting<String>

    private var selectionObserver: UserSettingObserver<String>?
    private var listObserver: UserSettingObserver<[AIProviderConfiguration]>?

    /// - Parameters:
    ///   - pluginManager: resolves a configuration's plugin template; nil (no plugin
    ///     host) simply leaves every configuration unresolvable, so the picker
    ///     degrades to the disabled model row rather than failing.
    ///   - selectedSetting: the pref holding the chosen provider (a configuration
    ///     UUID string, or one of `leadingChoices`' values).
    ///   - leadingChoices: sentinel entries shown above the configured providers.
    ///   - modelSetting: the per-configuration pref backing the Model row. A feature
    ///     that wants its own model for a shared configuration passes its own key
    ///     here, which is what lets summaries and oversight run one provider on two
    ///     different models.
    public init(
        pluginManager: AIPluginManager?,
        selectedSetting: UserSetting<String>,
        leadingChoices: [LeadingChoice] = [],
        modelSetting: @escaping (UUID, AIPluginDescriptor.ProviderTemplate) -> UserSetting<String>
    ) {
        self.pluginManager = pluginManager
        self.selectedSetting = selectedSetting
        self.leadingChoices = leadingChoices
        self.modelSetting = modelSetting

        super.init(frame: .zero)
        translatesAutoresizingMaskIntoConstraints = false

        buildLayout()

        providerPopup.target = self
        providerPopup.action = #selector(providerChanged(_:))
        chooseButton.target = self
        chooseButton.action = #selector(chooseTapped)

        selectionObserver = UserSettingObserver(selectedSetting) { [weak self] _ in
            self?.syncProviderSelection()
            self?.refreshModelRow()
        }
        listObserver = UserSettingObserver(UserSettings.aiProviderConfigurations) { [weak self] _ in
            self?.rebuildProviderChoices()
            self?.refreshModelRow()
        }

        rebuildProviderChoices()
        refreshModelRow()
    }

    @available(*, unavailable)
    public required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    /// Span the host stack's width, the way `GroupView` and `ChoiceSliderView` do:
    /// the enclosing stack aligns `.leading`, so without this the picker would be
    /// only as wide as its content and the Choose button would sit mid-panel
    /// instead of at the trailing edge.
    public override func viewDidMoveToSuperview() {
        super.viewDidMoveToSuperview()
        guard let parent = superview else { return }
        widthAnchor.constraint(equalTo: parent.widthAnchor).isActive = true
    }

    // MARK: - Scripted / testable surface

    /// The Provider popup, exposed so hosts' tests can drive the selection without
    /// synthetic clicks.
    public var providerPopUpButton: NSPopUpButton { providerPopup }
    /// The text currently in the model slot (a model name, or ``noProviderModelText``).
    public var modelNameText: String { modelNameLabel.stringValue }
    /// Whether a model can be chosen for the current selection.
    public var isChooseEnabled: Bool { chooseButton.isEnabled }

    // MARK: - Layout

    /// Two rows whose "Provider"/"Model" labels share one column of equal width,
    /// pinned to the *leading* edge so the picker starts where every other label in
    /// the host panel starts. (An `NSGridView` spreads its slack across the columns,
    /// which shoved the whole control against the trailing edge and left it looking
    /// right-justified next to the rows above and below it.)
    private func buildLayout() {
        for label in [providerLabel, modelLabel] {
            label.font = .systemFont(ofSize: 13, weight: .semibold)
            // Right-aligned *within* that shared column, so the two labels end
            // together and their controls line up.
            label.alignment = .right
            label.translatesAutoresizingMaskIntoConstraints = false
            label.setContentHuggingPriority(.required, for: .horizontal)
            label.setContentCompressionResistancePriority(.required, for: .horizontal)
        }
        modelNameLabel.lineBreakMode = .byTruncatingMiddle
        chooseButton.bezelStyle = .rounded
        chooseButton.setButtonType(.momentaryPushIn)

        // The name takes the slack and the button hugs the trailing edge, so the
        // button lands in the same place whatever the model is called.
        modelNameLabel.setContentHuggingPriority(.defaultLow, for: .horizontal)
        modelNameLabel.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        chooseButton.setContentHuggingPriority(.required, for: .horizontal)

        let modelRow = NSStackView(views: [modelNameLabel, chooseButton])
        modelRow.orientation = .horizontal
        modelRow.spacing = 8
        modelRow.alignment = .centerY
        modelRow.distribution = .fill
        modelRow.translatesAutoresizingMaskIntoConstraints = false
        providerPopup.translatesAutoresizingMaskIntoConstraints = false

        for view in [providerLabel, modelLabel, providerPopup, modelRow] { addSubview(view) }

        NSLayoutConstraint.activate([
            providerLabel.leadingAnchor.constraint(equalTo: leadingAnchor),
            modelLabel.leadingAnchor.constraint(equalTo: leadingAnchor),
            modelLabel.widthAnchor.constraint(equalTo: providerLabel.widthAnchor),

            providerPopup.leadingAnchor.constraint(equalTo: providerLabel.trailingAnchor, constant: 8),
            providerPopup.trailingAnchor.constraint(lessThanOrEqualTo: trailingAnchor),
            providerPopup.topAnchor.constraint(equalTo: topAnchor),
            providerLabel.centerYAnchor.constraint(equalTo: providerPopup.centerYAnchor),

            // Only the model row spans the rest of the width, so the Choose button
            // rides the trailing edge whatever the model is called; the popup above
            // it keeps its natural width.
            modelRow.leadingAnchor.constraint(equalTo: modelLabel.trailingAnchor, constant: 8),
            modelRow.trailingAnchor.constraint(equalTo: trailingAnchor),
            modelRow.topAnchor.constraint(equalTo: providerPopup.bottomAnchor, constant: 8),
            modelRow.bottomAnchor.constraint(equalTo: bottomAnchor),
            modelLabel.centerYAnchor.constraint(equalTo: modelRow.centerYAnchor)
        ])

        // The visible labels sit beside their controls but AppKit doesn't associate
        // them, so VoiceOver would announce both with no name.
        providerPopup.setAccessibilityTitleUIElement(providerLabel)
        chooseButton.setAccessibilityTitleUIElement(modelLabel)
    }

    // MARK: - Provider popup

    private func rebuildProviderChoices() {
        providerPopup.removeAllItems()
        for choice in leadingChoices {
            providerPopup.addItem(withTitle: choice.label)
            providerPopup.lastItem?.representedObject = choice.value
        }
        for config in UserSettings.aiProviderConfigurations.value {
            providerPopup.addItem(withTitle: config.name)
            providerPopup.lastItem?.representedObject = config.id.uuidString
        }
        syncProviderSelection()
    }

    private func syncProviderSelection() {
        let current = selectedSetting.value
        let index = providerPopup.itemArray.firstIndex {
            ($0.representedObject as? String) == current
        }
        if let index { providerPopup.selectItem(at: index) }
    }

    @objc private func providerChanged(_ sender: NSPopUpButton) {
        guard let value = sender.selectedItem?.representedObject as? String else { return }
        // Writing the pref fires `selectionObserver`, which refreshes the model row.
        if selectedSetting.value != value { selectedSetting.value = value }
    }

    // MARK: - Model row

    /// The configuration the current selection resolves to, together with its
    /// template — nil for a sentinel, an unknown id, or a configuration whose
    /// plugin/template is no longer installed.
    private func resolvedSelection()
        -> (config: AIProviderConfiguration, template: AIPluginDescriptor.ProviderTemplate)? {
        guard let uuid = UUID(uuidString: selectedSetting.value),
              let config = UserSettings.aiProviderConfigurations.value.first(where: { $0.id == uuid }),
              let template = pluginManager?.template(
                  pluginIdentifier: config.pluginIdentifier, templateId: config.templateId)
        else { return nil }
        return (config, template)
    }

    private func refreshModelRow() {
        guard let (config, template) = resolvedSelection() else {
            modelNameLabel.stringValue = Self.noProviderModelText
            modelNameLabel.textColor = .secondaryLabelColor
            chooseButton.isEnabled = false
            return
        }
        let stored = modelSetting(config.id, template).value
        modelNameLabel.stringValue = stored.isEmpty ? Self.noProviderModelText : stored
        modelNameLabel.textColor = stored.isEmpty ? .secondaryLabelColor : .labelColor
        chooseButton.isEnabled = true
    }

    @objc private func chooseTapped() {
        guard let window, let (config, template) = resolvedSelection() else { return }
        let setting = modelSetting(config.id, template)
        let context = Self.chooserContext(
            config: config, template: template, setting: setting, pluginManager: pluginManager
        )
        ModelChooser.present(over: window, context: context) { [weak self] chosen in
            setting.value = chosen
            self?.refreshModelRow()
        }
    }

    /// The chooser's context for `config`: scoped to its resolved field values
    /// (base URL, API key) so live catalog lookups (e.g. OpenAI-shaped `/models`)
    /// hit the right server, with the stored model (template default when unset)
    /// as the current selection. Split out of the presenting path (which ends in a
    /// modal) so the per-configuration wiring is testable without presenting UI.
    public static func chooserContext(
        config: AIProviderConfiguration,
        template: AIPluginDescriptor.ProviderTemplate,
        setting: UserSetting<String>,
        pluginManager: AIPluginManager?
    ) -> ModelChooserContext {
        let fields = pluginManager?.fields(pluginIdentifier: config.pluginIdentifier, template: template) ?? []
        let values = AIProviderConfigStore.configValues(for: config, template: template, fields: fields)
        return ModelChooserContext(
            pluginIdentifier: config.pluginIdentifier, template: template,
            baseURL: values["baseURL"] ?? "", apiKey: values["apiKey"],
            currentModel: setting.value.isEmpty ? template.resolvedDefaultModel : setting.value)
    }
}
