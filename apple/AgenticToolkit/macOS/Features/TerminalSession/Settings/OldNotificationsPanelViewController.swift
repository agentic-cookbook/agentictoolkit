import AgenticToolkitCoreMacOS
import AppKit

@MainActor
final class OldNotificationsPanelViewController: OldSettingsPanelViewController {
    private let viewModel: WhippetSettingsViewModel

    init(viewModel: WhippetSettingsViewModel) {
        self.viewModel = viewModel
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

    override var panelTitle: String { "Notifications" }
    override var icon: NSImage? {
        NSImage(systemSymbolName: "bell", accessibilityDescription: nil)
    }

    override func loadView() {
        view = OldNotificationsSettingsPane(viewModel: viewModel)
    }
}
