import AppKit
import AgenticToolkitCore
import AgenticToolkitCoreUI
import AgenticToolkitCoreMacOS
import AgenticToolkitMacOS


/// Composable settings panel base class for `AIPlugin` implementations.
/// Vends the standard model-popup and "API Key" groups (masked entry +
/// async Test + Clear actions) so each concrete plugin panel only has
/// to wire up its own per-plugin `UserSetting`s.
///
/// Subclasses override `viewDidLoad` and call `makeModelGroup(setting:)`
/// and/or `makeCredentialsGroup(apiKey:baseURL:)` to assemble groups in
/// the order they want.
@MainActor
open class PluginSettingsPanel: ComposableSettings.SettingsPanelViewController {

    public let plugin: any AIPlugin
    private let statusLabel = NSTextField(labelWithString: "")

    public init(plugin: any AIPlugin, title: String, icon: NSImage?) {
        self.plugin = plugin
        super.init(with: ComposableSettings.SettingsPanelDescriptor(title: title, icon: icon))
    }

    @available(*, unavailable)
    public required init?(coder: NSCoder) { fatalError() }

    /// Standard model-popup group seeded from `plugin.availableModels`.
    /// Returns nil if the plugin has no preset models — the
    /// `OpenAICompatible` case wants a free-form `TextEditView` instead.
    public func makeModelGroup(setting: UserSetting<String>) -> ComposableSettings.GroupView? {
        guard !plugin.availableModels.isEmpty else { return nil }
        let group = ComposableSettings.GroupView(withTitle: "Model")
        let viewModel = ComposableSettings.ChoiceViewModel<String>(
            title: "Model",
            setting: setting,
            choices: plugin.availableModels.map { .init(label: $0, value: $0) }
        )
        group.addSettingSubview(ComposableSettings.PopupMenuChoiceView(viewModel: viewModel))
        return group
    }

    /// Standard "API Key" group: masked entry, Test + Clear buttons, and a
    /// status label updated by the async validate call. Pass `baseURL` for
    /// plugins (e.g. OpenAI-compatible) whose credentials include a custom
    /// endpoint that should travel with the API key on test.
    public func makeCredentialsGroup(
        apiKey: UserSetting<String>,
        baseURL: UserSetting<String>? = nil
    ) -> ComposableSettings.GroupView {
        let group = ComposableSettings.GroupView(withTitle: "API Key")

        group.addSettingSubview(ComposableSettings.SecureTextEditView(
            with: ComposableSettings.ViewModel<String>(title: "API Key", setting: apiKey)
        ))

        let buttonRow = ComposableSettings.HorizontalStackView()
        buttonRow.addArrangedSubview(ComposableSettings.ButtonView(viewModel: ComposableSettings.ButtonViewModel(
            title: "Test API Key",
            wasPressedCallback: { [weak self] in
                self?.runCredentialsTest(apiKey: apiKey, baseURL: baseURL)
            }
        )))
        buttonRow.addArrangedSubview(ComposableSettings.ButtonView(viewModel: ComposableSettings.ButtonViewModel(
            title: "Clear Key",
            wasPressedCallback: { apiKey.remove() }
        )))
        group.addSettingSubview(buttonRow)

        statusLabel.font = .systemFont(ofSize: 11)
        statusLabel.textColor = .secondaryLabelColor
        group.addSettingSubview(statusLabel)

        return group
    }

    private func runCredentialsTest(apiKey: UserSetting<String>, baseURL: UserSetting<String>?) {
        let key = apiKey.value
        guard !key.isEmpty else {
            statusLabel.stringValue = "No API key entered"
            statusLabel.textColor = .systemRed
            return
        }
        statusLabel.stringValue = "Testing…"
        statusLabel.textColor = .secondaryLabelColor
        let resolvedBaseURL = baseURL?.value.trimmingCharacters(in: .whitespacesAndNewlines)
        let credentials = AIPluginCredentials(
            apiKey: key,
            baseURL: (resolvedBaseURL?.isEmpty == false) ? resolvedBaseURL : nil
        )
        let plugin = self.plugin
        Task { [weak self] in
            let error = await plugin.validateCredentials(credentials)
            await MainActor.run {
                guard let self else { return }
                if let error {
                    self.statusLabel.stringValue = error
                    self.statusLabel.textColor = .systemRed
                } else {
                    self.statusLabel.stringValue = "API key is valid"
                    self.statusLabel.textColor = .systemGreen
                }
            }
        }
    }
}
