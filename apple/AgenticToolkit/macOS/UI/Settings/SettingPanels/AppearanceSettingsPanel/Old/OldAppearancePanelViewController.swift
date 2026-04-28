import AgenticToolkitCoreMacOS
import AppKit

@MainActor
final class OldAppearancePanelViewController: OldSettingsPanelViewController {
    private let viewModel: WhippetSettingsViewModel

    init(viewModel: WhippetSettingsViewModel) {
        self.viewModel = viewModel
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

    override var panelTitle: String { "Appearance" }
    override var icon: NSImage? {
        NSImage(systemSymbolName: "paintbrush", accessibilityDescription: nil)
    }

    override func loadView() {
        view = OldAppearanceSettingsPane(viewModel: viewModel)
    }
}
