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

    public override func loadView() {
        let hosting = NSHostingView(rootView: FileTypesSettingsView().themedRoot())
        hosting.translatesAutoresizingMaskIntoConstraints = false
        self.view = hosting
    }
}
