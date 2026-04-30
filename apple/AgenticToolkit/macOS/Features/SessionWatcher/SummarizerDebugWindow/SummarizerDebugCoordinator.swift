import AppKit
import OSLog
import AgenticToolkitCore

extension SessionWatcher {

    /// Owns the SessionWatcher summarizer-debug window — the developer log
    /// panel that shows summarizer activity. Pure host-shell: contributes
    /// the menu item and `summarizerDebugVisible` scripting key, no
    /// inter-feature dependencies.
    @MainActor
    public final class SummarizerDebugCoordinator: AppFeature {

        public let windowController = SummarizerDebugWindowController()

        public override init() {
            super.init()

            self.menuContributions = [
                MenuContribution(slot: .window, title: "Summarizer Debug Log", order: 50) { [weak self] in
                    self?.showWindow()
                },
                MenuContribution(slot: .statusItem(section: 1), title: "Summarizer Debug Log", order: 10, key: "d") { [weak self] in
                    self?.showWindow()
                }
            ]

            self.scriptingKeys.insert("scriptingSummarizerDebugVisible")
        }

        public func showWindow() {
            windowController.showWindow()
        }

        public override func value(forScriptingKey key: String) -> Any? {
            switch key {
            case "scriptingSummarizerDebugVisible": return windowController.isVisible
            default: return nil
            }
        }

        public override func setValue(_ value: Any?, forScriptingKey key: String) {
            switch key {
            case "scriptingSummarizerDebugVisible":
                (value as? Bool) == true ? windowController.showWindow() : windowController.dismiss()
            default:
                break
            }
        }
    }
}

extension SessionWatcher.SummarizerDebugCoordinator: Loggable {
    public static nonisolated let logger = makeLogger()
}
