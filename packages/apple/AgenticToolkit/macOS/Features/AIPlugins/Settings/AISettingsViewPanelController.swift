import AgenticToolkitCoreMacOS
import AIPluginKit
import AppKit
import SwiftUI

/// The "LLM Providers" settings panel: a list of the user's configured LLM
/// providers with add/remove, beside a per-configuration editor. Providers come
/// from templates the installed plugins advertise; nothing here loads a plugin
/// binary until a configuration's chat test runs.
@MainActor
open class AIPanelViewController: ComposableSettings.SettingsPanelViewController {

    public let pluginManager: AIPluginManager
    private let viewModel: LLMProvidersListViewModel

    public init(pluginManager: AIPluginManager) {
        self.pluginManager = pluginManager
        self.viewModel = LLMProvidersListViewModel(pluginManager: pluginManager)
        super.init(with: ComposableSettings.SettingsPanelDescriptor(
            title: "LLM Providers",
            icon: NSImage(systemSymbolName: "cpu", accessibilityDescription: nil)
        ))
    }

    public required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    public override func loadView() {
        let hosting = NSHostingView(rootView: LLMProvidersView(viewModel: viewModel))
        hosting.translatesAutoresizingMaskIntoConstraints = false
        self.view = hosting
    }
}
