import KeyboardShortcuts
import SwiftUI
import AgenticToolkitCoreMacOS

/// The Shortcuts tab within Settings, showing a recorder for each
/// window-context action.
public struct ShortcutsSettingsTab: View {
    @EnvironmentObject private var appState: SystemWindowContextsModel

    public init() {}

    public var body: some View {
        Form {
            Section("\(appState.contextNoun) Switching") {
                ForEach(1...9, id: \.self) { index in
                    KeyboardShortcuts.Recorder(
                        "Switch to \(appState.contextNoun) \(index):",
                        name: KeyboardShortcuts.Name.contextSwitchByIndex[index - 1]
                    )
                }
            }

            Section("Navigation") {
                KeyboardShortcuts.Recorder("Next \(appState.contextNoun):", name: .nextContext)
                KeyboardShortcuts.Recorder("Previous \(appState.contextNoun):", name: .previousContext)
                KeyboardShortcuts.Recorder("\(appState.contextNoun) Picker:", name: .contextPicker)
            }

            Section("Window Actions") {
                KeyboardShortcuts.Recorder("Add Current Window:", name: .addWindow)
                KeyboardShortcuts.Recorder("Remove Window:", name: .removeWindow)
            }

            Section {
                Button("Reset All to Defaults") {
                    KeyboardShortcuts.reset(KeyboardShortcuts.Name.allWindowContextShortcuts)
                }
            }
        }
        .formStyle(.grouped)
        .padding()
    }
}
