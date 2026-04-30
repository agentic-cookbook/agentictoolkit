import AppKit
import OSLog
import AgenticToolkitCore

extension ComposableSettings {
    /// Owns the Whippet settings window and the gear-button bridge from the
    /// session-watcher panel. Whippet-local because the window is Whippet-local.
    @MainActor
    open class AppCoordinator: AppFeature {

        public let settingsWindow: ComposableSettings.SettingsWindow

        public init(
            windowTitle: String = "Settings",
            settingsPanels: [any ComposableSettingsPanel]
        ) {
            let settingsWindow = ComposableSettings.SettingsWindow()
            settingsWindow.windowTitle = windowTitle
            settingsWindow.settingPanels = settingsPanels

            settingsWindow.windowSpec = WindowSpec(
                defaultSize: NSSize(width: 720, height: 480),
                minSize: NSSize(width: 550, height: 420),
                defaultPosition: .center,
                persistsFrame: true
            )

            self.settingsWindow = settingsWindow
            super.init()

            self.menuContributions = [
                MenuContribution(slot: .app, title: "Settings…", order: 10, key: ",") { [weak self] in
                    self?.showWindow()
                }
            ]

            self.scriptingKeys = [
                "scriptingSettingsVisible"
            ]
        }

        public func showWindow() {
            NSApp.activate(ignoringOtherApps: true)
            settingsWindow.showWindow()
        }

        /// Append a panel to the settings sidebar after construction. Used for
        /// panels whose dependencies (plugin managers, coordinators) aren't
        /// available when `SettingsCoordinator` is built.
        public func addPanel(_ panel: any ComposableSettingsPanel) {
            settingsWindow.settingPanels += [panel]
        }

        public override func value(forScriptingKey key: String) -> Any? {
            switch key {
            case "scriptingSettingsVisible": return settingsWindow.isVisible
            default: return nil
            }
        }

        public override func setValue(_ value: Any?, forScriptingKey key: String) {
            switch key {
            case "scriptingSettingsVisible":
                if (value as? Bool) == true {
                    settingsWindow.showWindow()
                } else {
                    settingsWindow.dismiss()
                }
            default:
                break
            }
        }
    }

}
