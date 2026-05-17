import AppKit

extension SessionWatcher {

    @MainActor
    fileprivate static var summarizerDebugCoordinator: SummarizerDebugCoordinator? {
        NSApp.scriptingHost?.feature(SummarizerDebugCoordinator.self)
    }

    @objc(ShowSummarizerDebugCommand)
    public final class ShowSummarizerDebugCommand: MainActorScriptCommand, @unchecked Sendable {
        public override func performMain() -> Any? {
            SessionWatcher.summarizerDebugCoordinator?.showWindow()
            return nil
        }
    }

    @objc(HideSummarizerDebugCommand)
    public final class HideSummarizerDebugCommand: MainActorScriptCommand, @unchecked Sendable {
        public override func performMain() -> Any? {
            SessionWatcher.summarizerDebugCoordinator?.windowController.dismiss()
            return nil
        }
    }
}
