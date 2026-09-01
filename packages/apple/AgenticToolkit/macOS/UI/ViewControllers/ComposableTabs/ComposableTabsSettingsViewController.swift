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
        container.accessibilityID("project-window.project-settings")

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
        done.accessibilityID("project-window.project-settings.done")
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
        self.preferredContentSize = NSSize(width: 760, height: 520)
    }

    @objc private func close(_ sender: Any?) {
        dismiss(self)
    }
}

/// The sheet's topic list.
@MainActor
private final class ProjectSettingsSplitViewController: ComposableSettings.SplitViewController {

    private let tabsPanel: ProjectTabsSettingsPanel
    private let spacingPanel = ProjectSpacingSettingsPanel()

    /// A sheet has no free edge for a drawer to slide out of, so this split
    /// presents its help in a popover off the help button instead.
    private let help = ComposableSettings.HelpPopoverController()

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

    /// Wide enough for the Spacing panel's diagram, which is the widest thing
    /// either topic puts in the detail pane.
    override var detailMinimumThickness: CGFloat { 420 }

    /// A sheet has no remembered geometry to restore, and a divider the user
    /// drags in a transient dialog is a setting they never asked to keep.
    override var contentSizedSidebar: Bool { true }

    override func viewDidLoad() {
        super.viewDidLoad()
        helpPresenter = help
        addPanel(tabsPanel)
        addPanel(spacingPanel)
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

    override var helpContent: ComposableSettings.PanelHelp? {
        ComposableSettings.PanelHelp(topics: [
            .init(
                title: "Tab Bars",
                body: "Each enabled edge of the window carries its own tab bar. Every "
                    + "document tab gets one member on every enabled edge, so turning an "
                    + "edge off hides its bar without losing the tabs on it."
            ),
            .init(
                title: "This Project Only",
                body: "These edges belong to this project, not to the app — another "
                    + "project window keeps whatever edges it was given. Changes apply "
                    + "as you make them and are saved with the project. Spacing, on the "
                    + "next topic, is the opposite: it belongs to every window."
            )
        ])
    }

    override func viewDidLoad() {
        super.viewDidLoad()

        let group = ComposableSettings.GroupView(withTitle: "Tab Bars")

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

/// How much room the panes are given: around the group of them, and between
/// them.
@MainActor
private final class ProjectSpacingSettingsPanel: ComposableSettings.SettingsPanelViewController {

    init() {
        super.init(with: ComposableSettings.SettingsPanelDescriptor(
            title: "Spacing",
            icon: NSImage(systemSymbolName: "squareshape.split.2x2", accessibilityDescription: "Spacing")
        ))
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

    override var helpContent: ComposableSettings.PanelHelp? {
        ComposableSettings.PanelHelp(topics: [
            .init(
                title: "Around the Panes",
                body: "The four numbers on the outside are the room between the panes and "
                    + "the tab bars framing them, in points. Click an arrow to move that "
                    + "corner a point at a time — hold it down to keep going — or type a "
                    + "number and press Return. Up and down arrows adjust the field you "
                    + "are in."
            ),
            .init(
                title: "Between the Panes",
                body: "The two numbers in the middle are the gaps between panes: one for "
                    + "panes side by side, one for panes stacked. Each is the whole gap, "
                    + "not each pane's half — ten means ten points between two panes. The "
                    + "arrows pointing inward close the gap; the ones pointing outward "
                    + "open it. A gap of zero still drags: the divider keeps a few points "
                    + "of grab area whatever it is drawn at."
            ),
            .init(
                title: "Every Window",
                body: "Spacing belongs to the app, not to this project — every project "
                    + "window is spaced the same way. Changes apply to the window behind "
                    + "this sheet as you make them."
            )
        ])
    }

    override func viewDidLoad() {
        super.viewDidLoad()

        let group = ComposableSettings.GroupView(withTitle: "Panes")
        group.addSettingSubview(SpacingControl.boundToSettings(
            style: .panes,
            edges: PaneSpacing.edgeSettings,
            gutters: PaneSpacing.gutterSettings
        ))
        addGroup(group)
    }
}
