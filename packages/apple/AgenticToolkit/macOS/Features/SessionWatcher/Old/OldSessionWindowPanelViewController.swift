import AgenticToolkitCoreMacOS
import AppKit

@MainActor
final class OldSessionWindowPanelViewController: OldSettingsPanelViewController {
    private let viewModel: WhippetSettingsViewModel

    init(viewModel: WhippetSettingsViewModel) {
        self.viewModel = viewModel
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

    override var panelTitle: String { "Session Window" }
    override var icon: NSImage? {
        NSImage(systemSymbolName: "macwindow", accessibilityDescription: nil)
    }

    override func loadView() {
        view = OldSessionWindowSettingsPane(viewModel: viewModel)
    }
}
