import AppKit

extension SessionWatcher {
    /// KVC-compliant wrapper for a settings key-value pair for Cocoa Scripting.
    /// The `value` property is read-write and persists changes to the database.
    @objc(ScriptableSetting)
    public class ScriptableSetting: NSObject {

        @objc public let name: String
        public weak var sessionWatcherDatabaseManager: SessionWatcherDatabaseManager?

        public init(
            name: String,
            value: String,
            sessionWatcherDatabaseManager: SessionWatcherDatabaseManager?
        ) {
            self.name = name
            self._value = value
            self.sessionWatcherDatabaseManager = sessionWatcherDatabaseManager
            super.init()
        }

        // MARK: - Value Property (read-write)

        private var _value: String

        @objc var value: String {
            get { _value }
            set {
                _value = newValue
                try? sessionWatcherDatabaseManager?.setSetting(key: name, value: newValue)
            }
        }

        // MARK: - Object Specifier

        public override nonisolated var objectSpecifier: NSScriptObjectSpecifier? {
            // NSScriptObjectSpecifier isn't Sendable; ferry through a Box.
            // `name` is captured locally to avoid sending non-Sendable `self`.
            final class Box: @unchecked Sendable { var value: NSScriptObjectSpecifier? }
            let box = Box()
            let capturedName = name
            MainActor.assumeIsolated {
                guard let appDescription = NSApp.classDescription as? NSScriptClassDescription else {
                    return
                }
                box.value = NSNameSpecifier(
                    containerClassDescription: appDescription,
                    containerSpecifier: nil,
                    key: "scriptingSettings",
                    name: capturedName
                )
            }
            return box.value
        }
    }
}
