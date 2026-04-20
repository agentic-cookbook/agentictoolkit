import AppKit
import AgenticToolkit

/// Reusable settings view for a single `AgenticLLMPlugin`. Renders API key
/// entry + validate, model selection, and (for the OpenAI-compatible plugin)
/// a base URL field. Persists per-plugin values under keys scoped by the
/// plugin's identifier so each plugin gets its own credentials/config.
@MainActor
public final class PluginSettingsContentView: NSView {

    private let plugin: any AgenticLLMPlugin

    private let modelPopup = NSPopUpButton()
    private let apiKeyField = NSSecureTextField()
    private let apiKeyStatusLabel = NSTextField(labelWithString: "")
    private let testButton = NSButton(title: "Test API Key", target: nil, action: nil)
    private let clearButton = NSButton(title: "Clear Key", target: nil, action: nil)
    private let baseURLField = NSTextField()
    private let baseURLLabel = NSTextField(labelWithString: "Base URL:")
    private let apiKeyLabel = NSTextField(labelWithString: "API Key:")
    private let apiKeyRow = NSStackView()
    private let baseURLRow = NSStackView()

    private var apiKeyKey: String { "api_key_\(type(of: plugin).identifier)" }
    private var modelKey: String { "ai_model_\(type(of: plugin).identifier)" }
    private var baseURLKey: String { "ai_base_url_\(type(of: plugin).identifier)" }

    private var isOpenAICompatible: Bool {
        type(of: plugin).identifier == "com.agentictoolkit.plugin.openai-compatible"
    }

    public init(plugin: any AgenticLLMPlugin) {
        self.plugin = plugin
        super.init(frame: .zero)
        setupViews()
        loadInitialValues()
    }

    @available(*, unavailable)
    public required init?(coder: NSCoder) { fatalError() }

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

        // Model
        let modelLabel = NSTextField(labelWithString: "Model:")
        modelLabel.font = .systemFont(ofSize: 13, weight: .medium)
        stack.addArrangedSubview(modelLabel)

        modelPopup.target = self
        modelPopup.action = #selector(modelChanged)
        modelPopup.translatesAutoresizingMaskIntoConstraints = false
        modelPopup.widthAnchor.constraint(greaterThanOrEqualToConstant: 250).isActive = true
        stack.addArrangedSubview(modelPopup)

        // API Key
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

        // Base URL (openai-compatible only)
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

    // MARK: - Load / Persist

    private func loadInitialValues() {
        // Models
        modelPopup.removeAllItems()
        let models = plugin.availableModels
        if models.isEmpty {
            modelPopup.addItem(withTitle: "(no models)")
            modelPopup.isEnabled = false
        } else {
            for model in models { modelPopup.addItem(withTitle: model) }
            let stored = UserDefaults.standard.string(forKey: modelKey)
            let selected = stored.flatMap { models.contains($0) ? $0 : nil } ?? plugin.recommendedModel
            if let idx = models.firstIndex(of: selected) {
                modelPopup.selectItem(at: idx)
            }
        }

        // API key visibility + stored status
        let needsKey = plugin.requiresAPIKey
        apiKeyLabel.isHidden = !needsKey
        apiKeyRow.isHidden = !needsKey
        apiKeyStatusLabel.isHidden = !needsKey

        refreshAPIKeyStatus()

        // Base URL
        baseURLLabel.isHidden = !isOpenAICompatible
        baseURLRow.isHidden = !isOpenAICompatible
        if isOpenAICompatible {
            baseURLField.stringValue = UserDefaults.standard.string(forKey: baseURLKey) ?? ""
        }
    }

    private func refreshAPIKeyStatus() {
        let has = KeychainHelper.exists(forKey: apiKeyKey)
        apiKeyField.placeholderString = has ? "••••••••••••" : "Enter API key..."
        clearButton.isEnabled = has
        apiKeyStatusLabel.stringValue = has ? "API key stored in Keychain" : ""
        apiKeyStatusLabel.textColor = .secondaryLabelColor
    }

    // MARK: - Actions

    @objc private func modelChanged() {
        guard let title = modelPopup.selectedItem?.title else { return }
        UserDefaults.standard.set(title, forKey: modelKey)
    }

    @objc private func apiKeyEntered() {
        let key = apiKeyField.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !key.isEmpty else { return }
        KeychainHelper.set(key, forKey: apiKeyKey)
        apiKeyField.stringValue = ""
        refreshAPIKeyStatus()
    }

    @objc private func clearAPIKey() {
        KeychainHelper.delete(forKey: apiKeyKey)
        apiKeyField.stringValue = ""
        refreshAPIKeyStatus()
    }

    @objc private func testAPIKey() {
        apiKeyEntered()
        let stored = KeychainHelper.get(forKey: apiKeyKey) ?? ""
        guard !stored.isEmpty else {
            apiKeyStatusLabel.stringValue = "No API key entered"
            apiKeyStatusLabel.textColor = .systemRed
            return
        }
        let baseURL = isOpenAICompatible
            ? baseURLField.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
            : ""
        let creds = PluginCredentials(apiKey: stored, baseURL: baseURL.isEmpty ? nil : baseURL)

        apiKeyStatusLabel.stringValue = "Testing..."
        apiKeyStatusLabel.textColor = .secondaryLabelColor
        testButton.isEnabled = false

        let plugin = self.plugin
        Task { [weak self] in
            let error = await plugin.validateCredentials(creds)
            await MainActor.run {
                guard let self else { return }
                self.testButton.isEnabled = true
                if let error {
                    self.apiKeyStatusLabel.stringValue = error
                    self.apiKeyStatusLabel.textColor = .systemRed
                } else {
                    self.apiKeyStatusLabel.stringValue = "API key is valid"
                    self.apiKeyStatusLabel.textColor = .systemGreen
                }
            }
        }
    }

    @objc private func baseURLEntered() {
        let url = baseURLField.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
        UserDefaults.standard.set(url, forKey: baseURLKey)
    }
}
