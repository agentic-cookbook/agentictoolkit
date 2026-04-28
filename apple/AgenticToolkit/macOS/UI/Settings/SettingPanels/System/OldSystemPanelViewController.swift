import AgenticToolkitCoreMacOS
import AppKit

@MainActor
final class OldSystemPanelViewController: OldSettingsPanelViewController {
    private let viewModel: WhippetSettingsViewModel

    init(viewModel: WhippetSettingsViewModel) {
        self.viewModel = viewModel
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

    override var panelTitle: String { "System" }
    override var icon: NSImage? {
        NSImage(systemSymbolName: "lock.shield", accessibilityDescription: nil)
    }

    override func loadView() {
        view = OldSystemSettingsPane(viewModel: viewModel)
    }
}
