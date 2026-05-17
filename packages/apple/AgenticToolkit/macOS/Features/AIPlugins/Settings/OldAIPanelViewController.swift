import AgenticToolkitCoreMacOS
import AppKit

@MainActor
final class AIPanelViewController: OldSettingsPanelViewController {
    private let viewModel: WhippetSettingsViewModel

    init(viewModel: WhippetSettingsViewModel) {
        self.viewModel = viewModel
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

    override var panelTitle: String { "AI" }
    override var icon: NSImage? {
        NSImage(systemSymbolName: "brain", accessibilityDescription: nil)
    }

    override func loadView() {
        view = AISettingsPane(viewModel: viewModel)
    }
}
