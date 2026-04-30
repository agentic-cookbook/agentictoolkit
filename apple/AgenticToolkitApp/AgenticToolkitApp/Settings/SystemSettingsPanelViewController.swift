import AppKit
import AgenticToolkitCore
import AgenticToolkitCoreUI
import AgenticToolkitCoreMacOS
import AgenticToolkitMacOS

@MainActor
final class SystemSettingsPanelViewController: ComposableSettings.SettingsPanelViewController {
    private let viewModel: SettingsViewModel

    init(viewModel: SettingsViewModel) {
        self.viewModel = viewModel
        super.init(with: ComposableSettings.SettingsPanelDescriptor(
            title: "System",
            icon: NSImage(systemSymbolName: "lock.shield", accessibilityDescription: nil)
        ))
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

    override func loadView() {
        let container = NSView(frame: NSRect(x: 0, y: 0, width: 480, height: 400))
        let pane = SystemSettingsPane(viewModel: viewModel)
        pane.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(pane)
        NSLayoutConstraint.activate([
            pane.topAnchor.constraint(equalTo: container.topAnchor, constant: 20),
            pane.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: 20),
            pane.trailingAnchor.constraint(equalTo: container.trailingAnchor, constant: -20),
            pane.bottomAnchor.constraint(lessThanOrEqualTo: container.bottomAnchor, constant: -20)
        ])
        self.view = container
    }
}
