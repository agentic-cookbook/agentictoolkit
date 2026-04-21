import AppKit
import AgenticToolkitCore
import AgenticToolkitCoreUI
import AgenticToolkitChatWindow
import AgenticToolkitSettingsWindow

@MainActor
final class SystemSettingsPanelViewController: SettingsPanelViewController {
    private let viewModel: SettingsViewModel

    init(viewModel: SettingsViewModel) {
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
        let container = SettingsPanelView(frame: NSRect(x: 0, y: 0, width: 480, height: 400))
        let pane = SystemSettingsPane(viewModel: viewModel)
        pane.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(pane)
        NSLayoutConstraint.activate([
            pane.topAnchor.constraint(equalTo: container.topAnchor, constant: 20),
            pane.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: 20),
            pane.trailingAnchor.constraint(equalTo: container.trailingAnchor, constant: -20),
            pane.bottomAnchor.constraint(lessThanOrEqualTo: container.bottomAnchor, constant: -20),
        ])
        self.view = container
    }
}
