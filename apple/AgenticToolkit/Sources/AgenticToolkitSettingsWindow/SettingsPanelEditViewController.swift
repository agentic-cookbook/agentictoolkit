import AppKit

/// Right-hand edit pane that embeds the currently selected panel's view
/// controller as a child.
@MainActor
final class SettingsPanelEditViewController: NSViewController {

    private(set) var currentPanel: (any SettingsPanelViewController)?

    override func loadView() {
        self.view = NSView(frame: NSRect(x: 0, y: 0, width: 400, height: 400))
    }

    func show(_ panel: (any SettingsPanelViewController)?) {
        if let current = currentPanel {
            current.view.removeFromSuperview()
            current.removeFromParent()
        }
        currentPanel = panel
        guard let panel else { return }
        addChild(panel)
        panel.view.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(panel.view)
        NSLayoutConstraint.activate([
            panel.view.topAnchor.constraint(equalTo: view.topAnchor),
            panel.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            panel.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            panel.view.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])
    }
}
