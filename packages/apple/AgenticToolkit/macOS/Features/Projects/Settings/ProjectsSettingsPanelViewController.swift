import AppKit
import SwiftUI

/// Settings for project windows: how a pane shows it is the active one, and
/// what the project scan skips.
@MainActor
public final class ProjectsSettingsPanelViewController: ComposableSettings.SettingsPanelViewController {

    public override var hostsOwnScroll: Bool { true }

    public init() {
        super.init(with: ComposableSettings.SettingsPanelDescriptor(
            title: "Projects",
            icon: NSImage(systemSymbolName: "folder.badge.gearshape", accessibilityDescription: nil)
        ))
    }

    public required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    public override var helpContent: ComposableSettings.PanelHelp? {
        ComposableSettings.PanelHelp(topics: [
            .init(
                title: "Active Pane",
                body: "A project window is split into panes, and one of them is the one you "
                    + "are working in. With this on, that pane is drawn with a border in a "
                    + "tone one step lighter than the others — enough to find it, not enough "
                    + "to compete with what is inside it."
            ),
            .init(
                title: "Themes Override This",
                body: "A theme can carry its own answer for whether the active pane is "
                    + "outlined, and in what color, under the theme's Project topic in Theme "
                    + "settings. When it does, the theme wins over the switch here. A theme "
                    + "has no project options until you set them."
            ),
            .init(
                title: "Skipped Folders",
                body: "Folders in your home directory that the project scan never looks "
                    + "inside. Names match without regard to case, and `*` stands for any run "
                    + "of characters — `* Dropbox` covers `Acme Dropbox`. Only the home "
                    + "directory's own folders can match: these are root-level patterns, not "
                    + "a filter applied at every level of the walk."
            ),
            .init(
                title: "What a Pattern Excludes",
                body: "Each row names the folders it currently matches, so a pattern that "
                    + "has quietly stopped matching anything — a folder renamed, a drive "
                    + "unmounted — is visible instead of looking identical to one that is "
                    + "hiding half your work."
            )
        ])
    }

    public override func loadView() {
        let hosting = NSHostingView(rootView: ProjectsSettingsView().themedRoot())
        hosting.translatesAutoresizingMaskIntoConstraints = false
        self.view = hosting
    }
}
