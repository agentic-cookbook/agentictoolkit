import SwiftUI
import AgenticToolkitCoreMacOS

/// The composite Settings window for window-context management.
///
/// Presents tabs for managing contexts (rename, delete, color, window count),
/// their visualization, auto-assignment heuristics, keyboard shortcuts, and
/// general preferences. Host apps embed this in a SwiftUI `Settings` scene and
/// inject the model via `.environmentObject(_:)`.
public struct SystemWindowSettingsView: View {
    @EnvironmentObject private var appState: SystemWindowContextsModel

    public init() {}

    public var body: some View {
        TabView {
            ContextsSettingsTab()
                .environmentObject(appState)
                .tabItem {
                    Label(appState.contextNounPlural, systemImage: "square.stack.3d.up")
                }

            ContextVisualizationView()
                .environmentObject(appState)
                .tabItem {
                    Label("Visualization", systemImage: "rectangle.3.group")
                }

            HeuristicsSettingsTab()
                .environmentObject(appState)
                .tabItem {
                    Label("Heuristics", systemImage: "wand.and.stars")
                }

            ShortcutsSettingsTab()
                .environmentObject(appState)
                .tabItem {
                    Label("Shortcuts", systemImage: "keyboard")
                }

            GeneralSettingsTab()
                .environmentObject(appState)
                .tabItem {
                    Label("General", systemImage: "gearshape")
                }
        }
        .frame(minWidth: 480, idealWidth: 580, minHeight: 400, idealHeight: 560)
    }
}
