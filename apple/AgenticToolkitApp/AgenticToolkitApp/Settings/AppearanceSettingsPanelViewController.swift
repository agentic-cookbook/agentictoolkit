import AppKit
import AgenticToolkitCore
import AgenticToolkitCoreUI
import AgenticToolkitChatWindow
import AgenticToolkitSettingsWindow

@MainActor
final class AppearanceSettingsPanelViewController: NSViewController, SettingsPanelViewController {
    private let viewModel: SettingsViewModel

    init(viewModel: SettingsViewModel) {
        self.viewModel = viewModel
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

    var listItem: SettingsPanelListItem {
        SettingsPanelListItem(
            title: "Appearance",
            image: NSImage(systemSymbolName: "paintbrush", accessibilityDescription: nil)
        )
    }

    override func loadView() {
        let container = NSView(frame: NSRect(x: 0, y: 0, width: 480, height: 400))
        let pane = AppearanceSettingsPane(viewModel: viewModel)
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
