import AppKit
import Combine
import AgenticPluginSDK

/// Reusable AppKit view for AI/LLM plugin settings.
///
/// Contains: plugin picker, model picker, API key field with validation,
/// and base URL field (shown when the selected plugin is OpenAI-compatible).
public final class AISettingsView: NSView {
    private let viewModel: AISettingsViewModel
    private var cancellables = Set<AnyCancellable>()

    private let pluginPopup = NSPopUpButton()
    private let modelPopup = NSPopUpButton()
    private let apiKeyField = NSSecureTextField()
    private let apiKeyStatusLabel = NSTextField(labelWithString: "")
    private let testButton = NSButton(title: "Test API Key", target: nil, action: nil)
    private let clearButton = NSButton(title: "Clear Key", target: nil, action: nil)
    private let baseURLField = NSTextField()
    private let baseURLLabel = NSTextField(labelWithString: "Base URL:")
    private let enabledCheckbox = NSButton(checkboxWithTitle: "Enable AI features", target: nil, action: nil)

    // Containers for conditional visibility
    private let apiKeyLabel = NSTextField(labelWithString: "API Key:")
    private let apiKeyRow = NSStackView()
    private let baseURLRow = NSStackView()

    public init(viewModel: AISettingsViewModel) {
        self.viewModel = viewModel
        super.init(frame: .zero)
        setupViews()
        bindViewModel()
        updateFromViewModel()
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

    // MARK: - Setup

    private func setupViews() {
        let stack = NSStackView()
        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = 16
        stack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stack)

        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: topAnchor, constant: 20),
            stack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 20),
            stack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -20),
            stack.bottomAnchor.constraint(lessThanOrEqualTo: bottomAnchor, constant: -20),
        ])

        // Enabled checkbox
        enabledCheckbox.target = self
        enabledCheckbox.action = #selector(enabledToggled)
        stack.addArrangedSubview(enabledCheckbox)

        // Provider section
        let providerLabel = NSTextField(labelWithString: "Provider:")
        providerLabel.font = .systemFont(ofSize: 13, weight: .medium)
        stack.addArrangedSubview(providerLabel)

        pluginPopup.target = self
        pluginPopup.action = #selector(pluginChanged)
        pluginPopup.translatesAutoresizingMaskIntoConstraints = false
        pluginPopup.widthAnchor.constraint(greaterThanOrEqualToConstant: 250).isActive = true
        stack.addArrangedSubview(pluginPopup)

        // Model section
        let modelLabel = NSTextField(labelWithString: "Model:")
        modelLabel.font = .systemFont(ofSize: 13, weight: .medium)
        stack.addArrangedSubview(modelLabel)

        modelPopup.target = self
        modelPopup.action = #selector(modelChanged)
        modelPopup.translatesAutoresizingMaskIntoConstraints = false
        modelPopup.widthAnchor.constraint(greaterThanOrEqualToConstant: 250).isActive = true
        stack.addArrangedSubview(modelPopup)

        // API Key section
        apiKeyLabel.font = .systemFont(ofSize: 13, weight: .medium)
        stack.addArrangedSubview(apiKeyLabel)

        apiKeyField.placeholderString = "Enter API key..."
        apiKeyField.translatesAutoresizingMaskIntoConstraints = false
        apiKeyField.widthAnchor.constraint(greaterThanOrEqualToConstant: 250).isActive = true
        apiKeyField.target = self
        apiKeyField.action = #selector(apiKeyEntered)

        testButton.target = self
        testButton.action = #selector(testAPIKey)
        testButton.bezelStyle = .rounded

        clearButton.target = self
        clearButton.action = #selector(clearAPIKey)
        clearButton.bezelStyle = .rounded

        apiKeyRow.orientation = .horizontal
        apiKeyRow.spacing = 8
        apiKeyRow.addArrangedSubview(apiKeyField)
        apiKeyRow.addArrangedSubview(testButton)
        apiKeyRow.addArrangedSubview(clearButton)
        stack.addArrangedSubview(apiKeyRow)

        apiKeyStatusLabel.font = .systemFont(ofSize: 11)
        apiKeyStatusLabel.textColor = .secondaryLabelColor
        stack.addArrangedSubview(apiKeyStatusLabel)

        // Base URL section
        baseURLLabel.font = .systemFont(ofSize: 13, weight: .medium)
        stack.addArrangedSubview(baseURLLabel)

        baseURLField.placeholderString = "https://your-api.example.com"
        baseURLField.translatesAutoresizingMaskIntoConstraints = false
        baseURLField.widthAnchor.constraint(greaterThanOrEqualToConstant: 250).isActive = true
        baseURLField.target = self
        baseURLField.action = #selector(baseURLEntered)

        baseURLRow.orientation = .horizontal
        baseURLRow.spacing = 8
        baseURLRow.addArrangedSubview(baseURLField)
        stack.addArrangedSubview(baseURLRow)
    }

    // MARK: - Binding

    private func bindViewModel() {
        viewModel.$apiKeyTestState
            .receive(on: DispatchQueue.main)
            .sink { [weak self] state in self?.updateTestState(state) }
            .store(in: &cancellables)

        viewModel.$hasStoredAPIKey
            .receive(on: DispatchQueue.main)
            .sink { [weak self] has in
                self?.apiKeyField.placeholderString = has ? "••••••••••••" : "Enter API key..."
                self?.clearButton.isEnabled = has
            }
            .store(in: &cancellables)
    }

    private func updateFromViewModel() {
        // Populate plugin popup
        pluginPopup.removeAllItems()
        for metadata in viewModel.pluginManager.availablePlugins {
            pluginPopup.addItem(withTitle: metadata.displayName)
            pluginPopup.lastItem?.representedObject = metadata.identifier as NSString
        }
        // Select current
        if let idx = viewModel.pluginManager.availablePlugins.firstIndex(where: { $0.identifier == viewModel.selectedPluginIdentifier }) {
            pluginPopup.selectItem(at: idx)
        }

        updateModels()
        updateVisibility()

        enabledCheckbox.state = viewModel.isEnabled ? .on : .off
        baseURLField.stringValue = viewModel.baseURL
        clearButton.isEnabled = viewModel.hasStoredAPIKey
    }

    private func updateModels() {
        modelPopup.removeAllItems()
        let models = viewModel.availableModels
        if models.isEmpty {
            modelPopup.addItem(withTitle: "(enter model name)")
            modelPopup.isEnabled = false
        } else {
            for model in models {
                modelPopup.addItem(withTitle: model)
            }
            modelPopup.isEnabled = true
            if let idx = models.firstIndex(of: viewModel.selectedModel) {
                modelPopup.selectItem(at: idx)
            }
        }
    }

    private func updateVisibility() {
        let needsKey = viewModel.requiresAPIKey
        apiKeyLabel.isHidden = !needsKey
        apiKeyRow.isHidden = !needsKey
        apiKeyStatusLabel.isHidden = !needsKey

        // Show base URL for OpenAI-compatible plugin
        let isCustom = viewModel.selectedPluginIdentifier == "com.agentictoolkit.plugin.openai-compatible"
        baseURLLabel.isHidden = !isCustom
        baseURLRow.isHidden = !isCustom
    }

    private func updateTestState(_ state: APIKeyTestState) {
        switch state {
        case .idle:
            apiKeyStatusLabel.stringValue = viewModel.hasStoredAPIKey ? "API key stored in Keychain" : ""
            apiKeyStatusLabel.textColor = .secondaryLabelColor
            testButton.isEnabled = true
        case .testing:
            apiKeyStatusLabel.stringValue = "Testing..."
            apiKeyStatusLabel.textColor = .secondaryLabelColor
            testButton.isEnabled = false
        case .success:
            apiKeyStatusLabel.stringValue = "API key is valid"
            apiKeyStatusLabel.textColor = .systemGreen
            testButton.isEnabled = true
        case .failed(let message):
            apiKeyStatusLabel.stringValue = message
            apiKeyStatusLabel.textColor = .systemRed
            testButton.isEnabled = true
        }
    }

    // MARK: - Actions

    @objc private func enabledToggled() {
        viewModel.isEnabled = enabledCheckbox.state == .on
    }

    @objc private func pluginChanged() {
        guard let id = pluginPopup.selectedItem?.representedObject as? String else { return }
        viewModel.selectedPluginIdentifier = id
        updateModels()
        updateVisibility()
    }

    @objc private func modelChanged() {
        guard let title = modelPopup.selectedItem?.title else { return }
        viewModel.selectedModel = title
    }

    @objc private func apiKeyEntered() {
        let key = apiKeyField.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
        if !key.isEmpty {
            viewModel.apiKey = key
            apiKeyField.stringValue = ""
        }
    }

    @objc private func testAPIKey() {
        apiKeyEntered()  // Save any pending key first
        viewModel.testAPIKey()
    }

    @objc private func clearAPIKey() {
        viewModel.clearAPIKey()
    }

    @objc private func baseURLEntered() {
        viewModel.baseURL = baseURLField.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
