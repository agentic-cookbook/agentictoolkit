import AppKit
import OSLog
import AgenticToolkitCore

/// Owns the terminal-window subsystem: the live array of
/// `TerminalSessionWindowController` instances, the lifecycle delegate that
/// removes them when they close, and the AppleScript `new terminal`
/// command target. Contributes the File-menu and status-item terminal
/// items + the `terminalSessions` scripting key set.
@MainActor
public final class AIPluginsCoordinator: NSObject, AppFeature, MenuContributor, ScriptingContributor {

    public let pluginManager: AIPluginManager
    
    public init(appName: String, additionalSearchPaths: [URL] = []) {
        self.pluginManager = .init(appName: appName, additionalSearchPaths: additionalSearchPaths)
        
        self.pluginManager.discoverPlugins()
    }

    // MARK: - MenuContributor

    public func menuContributions() -> [MenuContribution] {
        [
        ]
    }

    public func settingsPanel() -> AIPanelViewController {
        AIPanelViewController(pluginManager: pluginManager)
    }
    
    // MARK: - ScriptingContributor

    public var scriptingKeys: Set<String> { [] }

    public func value(forScriptingKey key: String) -> Any? {
        switch key {
        default:
            return nil
        }
    }
}

extension AIPluginsCoordinator: Loggable {
    public static nonisolated let logger = makeLogger()
}
