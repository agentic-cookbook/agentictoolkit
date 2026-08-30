import AppKit

import AgenticToolkitCore
import AgenticToolkitCoreUI
import AgenticToolkitCoreMacOS

/// The project's own settings, as a sheet on its document window.
///
/// Deliberately the same shape as the app's Settings window — a topic list on
/// the left, a panel on the right — because it is the same kind of thing, just
/// scoped to one project. Reusing `ComposableSettings.SplitViewController` is
/// what makes a second topic a subclass and an `addPanel`, rather than a second
/// dialog (`optimize-for-change`).
@MainActor
public final class ComposableTabsSettingsViewController: NSViewController {

    private let panels: ProjectSettingsSplitViewController

    public init(
        isEdgeEnabled: @escaping (Edge) -> Bool,
        setEdgeEnabled: @escaping (Edge, Bool) -> Void
    ) {
        self.panels = ProjectSettingsSplitViewController(
            isEdgeEnabled: isEdgeEnabled,
            setEdgeEnabled: setEdgeEnabled
        )
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    public required init?(coder: NSCoder) { fatalError() }

    public override func loadView() {
        let container = ThemedBackgroundView(role: .windowBackground)
        container.accessibilityID("document-window.project-settings")

        addChild(panels)
        let panelsView = panels.view
        panelsView.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(panelsView)

        // Every change is applied as it is made — the edges toggle live behind
        // the sheet — so there is nothing to commit and nothing to cancel.
        let done = NSButton(title: "Done", target: self, action: #selector(close(_:)))
        done.bezelStyle = .rounded
        done.keyEquivalent = "\r"
        done.translatesAutoresizingMaskIntoConstraints = false
        done.accessibilityID("document-window.project-settings.done")
        container.addSubview(done)

        NSLayoutConstraint.activate([
            panelsView.topAnchor.constraint(equalTo: container.topAnchor),
            panelsView.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            container.trailingAnchor.constraint(equalTo: panelsView.trailingAnchor),

            done.topAnchor.constraint(equalTo: panelsView.bottomAnchor, constant: 12),
            container.trailingAnchor.constraint(equalTo: done.trailingAnchor, constant: 20),
            container.bottomAnchor.constraint(equalTo: done.bottomAnchor, constant: 16)
        ])

        self.view = container
        self.preferredContentSize = NSSize(width: 620, height: 420)
    }

    @objc private func close(_ sender: Any?) {
        dismiss(self)
    }
}

/// The sheet's topic list. One topic today; the class exists so the second one
/// is an `addPanel` call.
@MainActor
private final class ProjectSettingsSplitViewController: ComposableSettings.SplitViewController {

    private let tabsPanel: ProjectTabsSettingsPanel

    init(
        isEdgeEnabled: @escaping (Edge) -> Bool,
        setEdgeEnabled: @escaping (Edge, Bool) -> Void
    ) {
        self.tabsPanel = ProjectTabsSettingsPanel(
            isEdgeEnabled: isEdgeEnabled,
            setEdgeEnabled: setEdgeEnabled
        )
        super.init()
        self.sidebarTitle = "Project"
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

    /// The sheet is narrower than the settings *window*, so the detail floor
    /// has to be too or the sheet opens wider than it needs to be.
    override var detailMinimumThickness: CGFloat { 320 }

    /// A sheet has no remembered geometry to restore, and a divider the user
    /// drags in a transient dialog is a setting they never asked to keep.
    override var contentSizedSidebar: Bool { true }

    override func viewDidLoad() {
        super.viewDidLoad()
        addPanel(tabsPanel)
        selectPanel(at: 0)
    }
}

/// Which edges of the window carry a tab bar.
@MainActor
private final class ProjectTabsSettingsPanel: ComposableSettings.SettingsPanelViewController {

    private let isEdgeEnabled: (Edge) -> Bool
    private let setEdgeEnabled: (Edge, Bool) -> Void

    /// Reading order round the window, so the list looks like the thing it
    /// describes.
    private static let edges: [Edge] = [.top, .right, .bottom, .left]

    init(
        isEdgeEnabled: @escaping (Edge) -> Bool,
        setEdgeEnabled: @escaping (Edge, Bool) -> Void
    ) {
        self.isEdgeEnabled = isEdgeEnabled
        self.setEdgeEnabled = setEdgeEnabled
        super.init(with: ComposableSettings.SettingsPanelDescriptor(
            title: "Tabs",
            icon: NSImage(systemSymbolName: "rectangle.3.group", accessibilityDescription: "Tabs")
        ))
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

    override func viewDidLoad() {
        super.viewDidLoad()

        let group = ComposableSettings.GroupView(withTitle: "Tab Bars")
        group.addSettingSubview(ComposableSettings.ExplanationView(
            withText: "Each enabled edge carries its own tab bar. Every document tab "
                + "gets one member on every enabled edge, so turning an edge off "
                + "hides its bar without losing the tabs on it."
        ))

        for (index, edge) in Self.edges.enumerated() {
            let checkbox = NSButton(
                checkboxWithTitle: edge.displayName,
                target: self,
                action: #selector(toggleEdge(_:))
            )
            checkbox.tag = index
            checkbox.state = isEdgeEnabled(edge) ? .on : .off
            checkbox.accessibilityID("project-settings.tabs.\(edge.rawValue)")
            // A stock checkbox draws its title in the system label color, which
            // is the one thing on this panel the theme would otherwise miss.
            checkbox.observeTheme { button, palette in
                button.attributedTitle = NSAttributedString(
                    string: button.title,
                    attributes: [
                        .foregroundColor: palette.nsColor(.primaryText),
                        .font: palette.font(.body)
                    ]
                )
            }
            group.addSettingSubview(checkbox)
        }

        addGroup(group)
    }

    @objc private func toggleEdge(_ sender: NSButton) {
        guard Self.edges.indices.contains(sender.tag) else { return }
        setEdgeEnabled(Self.edges[sender.tag], sender.state == .on)
    }

}
