import AppKit
import AIPluginKit
import AgenticToolkitCore
import AgenticToolkitCoreMacOS

/// Try an LLM out: pick one of the configured providers, pick its model, and chat
/// with it — the "does this key work / is this the model I want" surface that used
/// to be crammed into every provider's settings editor.
///
/// ```
/// Provider: [popup]
///    Model: label                          [Choose Model…]
/// ─────────────────────────────────────────────────────────
/// [chat transcript]
/// [chat entry]
/// [Cancel] [Choose]      ← only when presented as a modal picker
/// ```
///
/// Two presentations share this one controller: a plain window
/// (``LLMChatWindowController``) and an app-modal picker (``LLMChatPicker``) that
/// reports the provider + model the user settled on. `showsChoiceButtons` is what
/// tells them apart.
///
/// Choosing a model **persists** it to that configuration (the same
/// `AIProviderConfigStore` write the settings editor used to do), in both
/// presentations. The chat is pinned to the live configuration, so the very next
/// message goes to the model just chosen.
@MainActor
public final class LLMChatViewController: NSViewController, Themeable {

    /// Called with the chosen provider + model, or `nil` on cancel. Only meaningful
    /// in picker mode; the presenter sets it.
    public var completion: ((Selection?) -> Void)?

    /// Picker mode: show the Cancel / Choose bar under the chat. Declared at init
    /// rather than inferred from `completion` because `loadView` runs the moment a
    /// window is built around this controller — before a presenter could assign it.
    private let showsChoiceButtons: Bool
    private let pluginManager: AIPluginManager
    private var configurations: [AIProviderConfiguration]
    private var selectedIndex: Int
    /// A model handed in by the presenter (`init(model:)` / `refresh(model:)`) that
    /// is deliberately NOT written to the store — it only points this window at a
    /// model. Cleared the moment the provider changes or a real choice is made.
    private var overrideModel: String = ""
    /// Rebuilt whenever the provider changes; nil when nothing is configured.
    private var chatSession: AIProviderChatSession?

    private let providerLabel = NSTextField(labelWithString: "Provider:")
    private let modelLabel = NSTextField(labelWithString: "Model:")
    private let providerPopUp = NSPopUpButton()
    private let modelValue = NSTextField(labelWithString: "")
    private let chooseModelButton = NSButton()
    private let separator = ThemedSeparatorView(role: .border)
    private let chatContainer = NSView()
    private let emptyLabel = NSTextField(labelWithString:
        "No LLM providers are configured. Add one in Settings › LLM Providers.")
    private let cancelButton = NSButton()
    private let chooseButton = NSButton()

    private var themeObserver: ThemePaletteObserver?
    private var chatView: ChatView?

    /// The window's initial content size. Not `preferredContentSize`: setting that
    /// on a window's contentViewController pins min == max and defeats `.resizable`.
    public let initialContentSize = NSSize(width: 560, height: 620)

    /// - Parameters:
    ///   - configuration: the provider to open on. `nil` opens on the first
    ///     configured provider (or on nothing, when there are none).
    ///   - model: the model to open on. `nil` uses the provider's stored/default
    ///     model. A model is never written to the store just for being passed in —
    ///     only an explicit choice persists.
    ///   - showsChoiceButtons: picker mode — add the Cancel / Choose bar.
    public init(pluginManager: AIPluginManager,
                configuration: AIProviderConfiguration? = nil,
                model: String? = nil,
                showsChoiceButtons: Bool = false) {
        self.pluginManager = pluginManager
        self.showsChoiceButtons = showsChoiceButtons
        let configs = UserSettings.aiProviderConfigurations.value
        self.configurations = configs
        self.selectedIndex = configuration.flatMap { wanted in
            configs.firstIndex { $0.id == wanted.id }
        } ?? (configs.isEmpty ? -1 : 0)
        super.init(nibName: nil, bundle: nil)
        if let model, !model.isEmpty { self.overrideModel = model }
    }

    @available(*, unavailable)
    public required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    /// The provider + model currently shown, or `nil` when nothing is configured.
    public var selection: Selection? {
        guard let config = selectedConfiguration else { return nil }
        return Selection(configuration: config, model: currentModel)
    }

    /// The transcript being driven, so automation can send/read messages the chat's
    /// own text field won't take synthetically.
    public var chatViewModel: ChatViewModel? { chatSession?.viewModel }

    private var selectedConfiguration: AIProviderConfiguration? {
        guard selectedIndex >= 0, selectedIndex < configurations.count else { return nil }
        return configurations[selectedIndex]
    }

    /// The model the chat is pointed at: the presenter's override if there is one,
    /// else whatever the store says right now.
    ///
    /// Read live rather than mirrored in a stored property. The same store key is
    /// written from two places — the model chooser here, and the host app's own
    /// feature settings — and the chat backend resolves the model afresh on every
    /// turn, so a cached copy went on labelling the window with a model that
    /// messages were no longer being sent to.
    private var currentModel: String {
        guard overrideModel.isEmpty else { return overrideModel }
        guard let config = selectedConfiguration, let template = selectedTemplate else { return "" }
        return AIProviderConfigStore.selectedModel(config: config, template: template)
    }

    private var selectedTemplate: AIPluginDescriptor.ProviderTemplate? {
        guard let config = selectedConfiguration else { return nil }
        return pluginManager.template(
            pluginIdentifier: config.pluginIdentifier, templateId: config.templateId)
    }

    // MARK: - View tree

    public override func loadView() {
        let root = NSView()
        root.wantsLayer = true

        configureHeader()
        configureChoiceButtons()

        emptyLabel.alignment = .center
        emptyLabel.lineBreakMode = .byWordWrapping
        emptyLabel.maximumNumberOfLines = 0
        emptyLabel.isHidden = true

        for subview in [providerLabel, modelLabel, providerPopUp, modelValue, chooseModelButton,
                        separator, chatContainer, emptyLabel] {
            subview.translatesAutoresizingMaskIntoConstraints = false
            root.addSubview(subview)
        }

        var constraints: [NSLayoutConstraint] = [
            providerLabel.leadingAnchor.constraint(equalTo: root.leadingAnchor, constant: 16),
            providerLabel.centerYAnchor.constraint(equalTo: providerPopUp.centerYAnchor),
            providerLabel.widthAnchor.constraint(equalTo: modelLabel.widthAnchor),

            providerPopUp.topAnchor.constraint(equalTo: root.topAnchor, constant: 16),
            providerPopUp.leadingAnchor.constraint(equalTo: providerLabel.trailingAnchor, constant: 8),
            providerPopUp.trailingAnchor.constraint(lessThanOrEqualTo: root.trailingAnchor, constant: -16),

            modelLabel.leadingAnchor.constraint(equalTo: root.leadingAnchor, constant: 16),
            modelLabel.centerYAnchor.constraint(equalTo: chooseModelButton.centerYAnchor),

            modelValue.leadingAnchor.constraint(equalTo: modelLabel.trailingAnchor, constant: 8),
            modelValue.centerYAnchor.constraint(equalTo: chooseModelButton.centerYAnchor),
            // The flexible space between the model name and the button: the name
            // may claim it, but never crowds the button off the trailing edge.
            modelValue.trailingAnchor.constraint(
                lessThanOrEqualTo: chooseModelButton.leadingAnchor, constant: -8),

            chooseModelButton.topAnchor.constraint(equalTo: providerPopUp.bottomAnchor, constant: 8),
            chooseModelButton.trailingAnchor.constraint(equalTo: root.trailingAnchor, constant: -16),

            separator.topAnchor.constraint(equalTo: chooseModelButton.bottomAnchor, constant: 12),
            separator.leadingAnchor.constraint(equalTo: root.leadingAnchor),
            separator.trailingAnchor.constraint(equalTo: root.trailingAnchor),

            chatContainer.topAnchor.constraint(equalTo: separator.bottomAnchor),
            chatContainer.leadingAnchor.constraint(equalTo: root.leadingAnchor),
            chatContainer.trailingAnchor.constraint(equalTo: root.trailingAnchor),

            emptyLabel.centerXAnchor.constraint(equalTo: chatContainer.centerXAnchor),
            emptyLabel.centerYAnchor.constraint(equalTo: chatContainer.centerYAnchor),
            emptyLabel.widthAnchor.constraint(lessThanOrEqualTo: chatContainer.widthAnchor, constant: -48)
        ]

        if !showsChoiceButtons {
            constraints.append(chatContainer.bottomAnchor.constraint(equalTo: root.bottomAnchor))
        } else {
            for button in [cancelButton, chooseButton] {
                button.translatesAutoresizingMaskIntoConstraints = false
                root.addSubview(button)
            }
            constraints += [
                chatContainer.bottomAnchor.constraint(equalTo: chooseButton.topAnchor, constant: -12),
                chooseButton.trailingAnchor.constraint(equalTo: root.trailingAnchor, constant: -16),
                chooseButton.bottomAnchor.constraint(equalTo: root.bottomAnchor, constant: -16),
                cancelButton.trailingAnchor.constraint(equalTo: chooseButton.leadingAnchor, constant: -10),
                cancelButton.centerYAnchor.constraint(equalTo: chooseButton.centerYAnchor),
                // Cancel is drawn by the theme rather than by a stock bezel (see
                // `applySecondaryActionTheme`), so its size is stated here — matching
                // the default button beside it — instead of coming from the bezel.
                cancelButton.heightAnchor.constraint(equalTo: chooseButton.heightAnchor),
                cancelButton.widthAnchor.constraint(greaterThanOrEqualToConstant: 72)
            ]
        }

        NSLayoutConstraint.activate(constraints)
        self.view = root
        themeObserver = ThemePaletteObserver { [weak self] palette in self?.applyTheme(palette) }
    }

    public override func viewDidLoad() {
        super.viewDidLoad()
        reloadProviders()
    }

    // MARK: - Subview configuration

    private func configureHeader() {
        providerLabel.alignment = .right
        modelLabel.alignment = .right
        modelValue.lineBreakMode = .byTruncatingMiddle
        // Let the value give up width before the label column or the button do.
        modelValue.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        modelValue.setContentHuggingPriority(.defaultLow, for: .horizontal)

        providerPopUp.target = self
        providerPopUp.action = #selector(providerChanged)

        chooseModelButton.title = "Choose Model…"
        chooseModelButton.bezelStyle = .rounded
        chooseModelButton.setButtonType(.momentaryPushIn)
        chooseModelButton.target = self
        chooseModelButton.action = #selector(chooseModelAction)
    }

    private func configureChoiceButtons() {
        cancelButton.title = "Cancel"
        cancelButton.bezelStyle = .rounded
        cancelButton.setButtonType(.momentaryPushIn)
        cancelButton.keyEquivalent = "\u{1b}"          // Escape
        cancelButton.target = self
        cancelButton.action = #selector(cancelAction)

        chooseButton.title = "Choose"
        chooseButton.bezelStyle = .rounded
        chooseButton.setButtonType(.momentaryPushIn)
        // Deliberately NO Return key equivalent: Return in this window sends the
        // message the user is typing. A default button here would swallow it.
        chooseButton.target = self
        chooseButton.action = #selector(chooseAction)
    }

    // MARK: - Provider / model state

    /// Re-reads the configured providers and points the chat at `configuration`
    /// (or keeps the current one when it's `nil` and still exists). The window is a
    /// singleton that outlives any number of add/remove edits in Settings, so
    /// re-showing it has to pick up that list again rather than trust the snapshot
    /// taken at init.
    ///
    /// Rebuilds the transcript only when the selected provider actually changes —
    /// re-showing the window on the same provider keeps the conversation.
    public func refresh(selecting configuration: AIProviderConfiguration? = nil, model: String? = nil) {
        let previous = selectedConfiguration?.id
        configurations = UserSettings.aiProviderConfigurations.value
        let wanted = configuration?.id ?? previous
        selectedIndex = wanted.flatMap { id in configurations.firstIndex { $0.id == id } }
            ?? (configurations.isEmpty ? -1 : 0)
        let sameProvider = previous != nil && selectedConfiguration?.id == previous
        // A different provider carries its own model, so drop any override and let
        // `currentModel` fall through to that provider's stored one; an explicit
        // `model` overrides either way.
        overrideModel = model ?? (sameProvider ? overrideModel : "")
        guard isViewLoaded else { return }
        if sameProvider, chatSession != nil {
            syncPopUpTitles()
            updateModelRow()
        } else {
            reloadProviders()
        }
    }

    /// Refreshes the pop-up's items without disturbing the live chat — for a rename
    /// or a sibling provider added/removed while this window stayed open.
    private func syncPopUpTitles() {
        providerPopUp.removeAllItems()
        providerPopUp.addItems(withTitles: configurations.map(\.name))
        providerPopUp.isEnabled = !configurations.isEmpty
        if selectedIndex >= 0 { providerPopUp.selectItem(at: selectedIndex) }
    }

    /// Repopulates the provider pop-up from the stored configurations and rebuilds
    /// the chat for whichever one is selected.
    private func reloadProviders() {
        providerPopUp.removeAllItems()
        if configurations.isEmpty {
            providerPopUp.addItem(withTitle: "No providers configured")
            providerPopUp.isEnabled = false
        } else {
            providerPopUp.addItems(withTitles: configurations.map(\.name))
            providerPopUp.isEnabled = true
            providerPopUp.selectItem(at: max(0, selectedIndex))
        }
        rebuildChat()
    }

    @objc private func providerChanged() {
        let index = providerPopUp.indexOfSelectedItem
        guard index != selectedIndex, index >= 0, index < configurations.count else { return }
        selectedIndex = index
        // A provider carries its own model; keep nothing from the previous one.
        overrideModel = ""
        rebuildChat()
    }

    /// Swaps in a chat pinned to the selected configuration and refreshes the model
    /// row. Called on load and on every provider change — the backend is pinned to
    /// one configuration, so a new provider means a new session and a fresh
    /// transcript.
    private func rebuildChat() {
        chatView?.removeFromSuperview()
        chatView = nil
        chatSession = nil

        guard let config = selectedConfiguration else {
            emptyLabel.isHidden = false
            modelValue.stringValue = "—"
            chooseModelButton.isEnabled = false
            chooseButton.isEnabled = false
            return
        }

        emptyLabel.isHidden = true
        updateModelRow()

        let session = AIProviderChatSession(configuration: config, pluginManager: pluginManager)
        let view = ChatView(viewModel: session.viewModel)
        view.translatesAutoresizingMaskIntoConstraints = false
        chatContainer.addSubview(view)
        NSLayoutConstraint.activate([
            view.topAnchor.constraint(equalTo: chatContainer.topAnchor),
            view.leadingAnchor.constraint(equalTo: chatContainer.leadingAnchor),
            view.trailingAnchor.constraint(equalTo: chatContainer.trailingAnchor),
            view.bottomAnchor.constraint(equalTo: chatContainer.bottomAnchor)
        ])
        chatSession = session
        chatView = view
    }

    private func updateModelRow() {
        let template = selectedTemplate
        // Show the Model row's Choose button whenever the provider can offer a model:
        // a live-fetch provider (Ollama etc.) always can, even though its static list
        // is empty; others when they ship a list or already have a model chosen.
        let offersModels = selectedConfiguration.map {
            ModelChooserContent.supportsLiveModels(pluginIdentifier: $0.pluginIdentifier)
        } ?? false
        chooseModelButton.isEnabled = template != nil
            && (offersModels || !(template?.models.isEmpty ?? true) || !currentModel.isEmpty)
        modelValue.stringValue = currentModel.isEmpty ? "None chosen" : currentModel
        chooseButton.isEnabled = selectedConfiguration != nil
        applyModelRowTheme(ThemePaletteObserver.currentPalette)
    }

    // MARK: - Actions

    @objc private func chooseModelAction() {
        guard let window = view.window,
              let config = selectedConfiguration,
              let template = selectedTemplate else { return }
        let fields = pluginManager.fields(pluginIdentifier: config.pluginIdentifier, template: template)
        let values = AIProviderConfigStore.configValues(for: config, template: template, fields: fields)
        let context = ModelChooserContext(
            pluginIdentifier: config.pluginIdentifier, template: template,
            baseURL: values["baseURL"] ?? "", apiKey: values["apiKey"],
            currentModel: currentModel.isEmpty ? template.resolvedDefaultModel : currentModel)
        ModelChooser.present(over: window, context: context) { [weak self] model in
            guard let self else { return }
            // The chooser runs its own modal session, and the window it sits over can
            // be pointed somewhere else while it is up — a scripted `send test
            // message` on another provider, or a `refresh` from Settings. Persisting
            // then would write this model against the provider that was showing when
            // the chooser opened, while the label and the transcript describe the one
            // showing now.
            guard self.selectedConfiguration?.id == config.id else { return }
            self.selectModel(model, template: template, config: config)
        }
    }

    /// Commits a model choice: persist it against the configuration, refresh the
    /// label, and — if a conversation is under way — post a "Model changed to …"
    /// notice into the transcript.
    private func selectModel(_ model: String,
                             template: AIPluginDescriptor.ProviderTemplate,
                             config: AIProviderConfiguration) {
        let previous = currentModel.isEmpty ? template.resolvedDefaultModel : currentModel
        AIProviderConfigStore.modelSetting(config: config.id, template: template).value = model
        // The store now holds the answer, so the presenter's override has to go —
        // leaving it would make the window ignore the choice just made.
        overrideModel = ""
        updateModelRow()
        if model != previous { chatSession?.viewModel.noteModelChanged(to: model) }
    }

    @objc private func chooseAction() {
        guard let done = completion, let selection else { return }
        completion = nil
        done(selection)
    }

    @objc private func cancelAction() {
        guard let done = completion else { return }
        completion = nil
        done(nil)
    }

    // MARK: - Theme

    public func applyTheme(_ palette: SemanticPalette) {
        view.layer?.backgroundColor = palette.windowBackgroundColor.cgColor
        providerLabel.textColor = palette.secondaryTextColor
        modelLabel.textColor = palette.secondaryTextColor
        emptyLabel.textColor = palette.secondaryTextColor
        // The same explicit Cancel styling the pickers use, so the dialogs agree —
        // AppKit's stock bezel does not (see `applySecondaryActionTheme`).
        cancelButton.applySecondaryActionTheme(palette)
        applyModelRowTheme(palette)
    }

    /// The model name greys out when there isn't one, so "None chosen" reads as a
    /// placeholder rather than as a model called that.
    private func applyModelRowTheme(_ palette: SemanticPalette) {
        modelValue.textColor = currentModel.isEmpty ? palette.secondaryTextColor : palette.primaryTextColor
    }
}

extension LLMChatViewController {

    /// What the modal picker reports back: which configured provider, and which of
    /// its models.
    public struct Selection: Sendable, Equatable {
        public let configuration: AIProviderConfiguration
        public let model: String

        public init(configuration: AIProviderConfiguration, model: String) {
            self.configuration = configuration
            self.model = model
        }
    }
}

// MARK: - Window delegate (picker presentation only)

/// Only ``LLMChatPicker`` attaches this — the standalone window's delegate is its
/// `SingleWindowController`, which does its own frame persistence.
extension LLMChatViewController: NSWindowDelegate {

    /// Frame-persistence key for the modal picker window, so its size + location go
    /// through the app's `WindowManager` like every other window.
    public static let pickerWindowID = "llm-chat-picker"

    public func windowShouldClose(_ sender: NSWindow) -> Bool {
        guard completion != nil else { return true }
        cancelAction()   // routes through completion → dismiss; don't let AppKit also close
        return false
    }

    public func windowDidMove(_ notification: Notification) { persistFrame(notification) }
    public func windowDidResize(_ notification: Notification) { persistFrame(notification) }

    private func persistFrame(_ notification: Notification) {
        guard let window = notification.object as? NSWindow else { return }
        WindowManager.shared.frames.saveFrame(for: window, id: Self.pickerWindowID)
    }
}
