import AgenticToolkitCoreMacOS
import AppKit

@MainActor
final class OldGeneralPanelViewController: OldSettingsPanelViewController {
    private let viewModel: WhippetSettingsViewModel

    init(viewModel: WhippetSettingsViewModel) {
        self.viewModel = viewModel
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

    override var panelTitle: String { "General" }
    override var icon: NSImage? {
        NSImage(systemSymbolName: "gearshape", accessibilityDescription: nil)
    }

    override func loadView() {
        view = OldGeneralSettingsPane(viewModel: viewModel)
    }
}
