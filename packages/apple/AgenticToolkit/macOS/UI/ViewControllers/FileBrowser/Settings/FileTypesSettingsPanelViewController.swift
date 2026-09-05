import AppKit
import SwiftUI

import AgenticToolkitCore
import AgenticToolkitCoreMacOS

/// Settings panel for the file browser's file-type associations: every
/// extension the editor recognises, plus the user's own overrides.
///
/// `FileTypesSettingsView` is the whole panel — this is the AppKit shell that
/// lets the settings window hold it, the same shape every other SwiftUI panel
/// uses.
@MainActor
public final class FileTypesSettingsPanelViewController: ComposableSettings.SettingsPanelViewController {

    /// The view is a `List`, so it scrolls itself; the detail pane must not wrap
    /// it in a second scroll view.
    public override var hostsOwnScroll: Bool { true }

    public init() {
        super.init(with: ComposableSettings.SettingsPanelDescriptor(
            title: "File Types",
            icon: NSImage(systemSymbolName: "doc.badge.gearshape", accessibilityDescription: nil)
        ))
    }

    public required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    public override var helpContent: ComposableSettings.PanelHelp? {
        ComposableSettings.PanelHelp(topics: [
            .init(
                title: "File Types",
                body: "Which language and icon the file browser and editor use for a given "
                    + "extension. The built-in list comes from the editor's own language "
                    + "definitions — it is what drives syntax highlighting, not just the "
                    + "icon in the tree."
            ),
            .init(
                title: "Custom Mappings",
                body: "A custom mapping takes precedence over the built-in entry for the "
                    + "same extension, so this is how you both add an extension the editor "
                    + "does not know and re-point one it gets wrong. Extensions are matched "
                    + "without the leading dot and without regard to case."
            ),
            .init(
                title: "Removing a Mapping",
                body: "The minus button at the end of a custom row deletes it. The built-in "
                    + "entry underneath it comes back — a custom mapping shadows a built-in "
                    + "one, it never replaces it."
            )
        ])
    }

    /// The sidebar's search cannot read a SwiftUI panel's controls, so this
    /// panel names what it is about.
    public override var searchKeywords: [String] {
        ["file type", "extension", "language", "syntax", "highlighting", "icon", "mapping"]
    }

    public override func loadView() {
        self.view = Self.hostingView(for: FileTypesSettingsView().themedRoot())
    }
}
