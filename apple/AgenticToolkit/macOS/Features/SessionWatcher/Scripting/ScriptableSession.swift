import AppKit

extension SessionWatcher {
    /// KVC-compliant wrapper around a `SessionWatcherSession` for Cocoa Scripting.
    /// Each property maps to a key declared in the host's `.sdef` scripting dictionary.
    @objc(ScriptableSession)
    public class ScriptableSession: NSObject {
        
        public let session: SessionWatcherSession
        
        public init(session: SessionWatcherSession) {
            self.session = session
            super.init()
        }
        
        // MARK: - Scripting Properties
        
        @objc var sessionId: String { session.sessionId }
        @objc var displayName: String { session.displayLabel }
        @objc var projectName: String { session.projectName }
        @objc var workingDirectory: String { session.cwd }
        @objc var model: String { session.model }
        @objc var gitBranch: String { session.gitBranch }
        @objc var summary: String { session.summary }
        @objc var lastTool: String { session.lastTool }
        @objc var startedAt: String { session.startedAt }
        @objc var lastActivity: String { session.lastActivityAt }
        @objc var processId: Int { Int(session.pid) }
        @objc var terminalProgram: String { session.termProgram }
        
        /// Returns the session status as an AppleScript enumeration descriptor.
        @objc var scriptingStatus: NSAppleEventDescriptor {
            let code: FourCharCode
            switch session.status {
            case .active: code = Self.fourCC("WpAc")
            case .stale:  code = Self.fourCC("WpSl")
            case .ended:  code = Self.fourCC("WpEn")
            }
            return NSAppleEventDescriptor(enumCode: code)
        }
        
        // MARK: - Object Specifier
        
        public override nonisolated var objectSpecifier: NSScriptObjectSpecifier? {
            // NSScriptObjectSpecifier isn't Sendable; ferry through a Box.
            // `sessionId` captured locally to avoid sending non-Sendable `self`.
            final class Box: @unchecked Sendable { var value: NSScriptObjectSpecifier? }
            let box = Box()
            let capturedSessionId = session.sessionId
            MainActor.assumeIsolated {
                guard let appDescription = NSApp.classDescription as? NSScriptClassDescription else {
                    return
                }
                box.value = NSUniqueIDSpecifier(
                    containerClassDescription: appDescription,
                    containerSpecifier: nil,
                    key: "sessions",
                    uniqueID: capturedSessionId
                )
            }
            return box.value
        }
    
        /// Converts a 4-character string to a FourCharCode (OSType).
        private static func fourCC(_ string: String) -> FourCharCode {
            var result: FourCharCode = 0
            for char in string.utf8.prefix(4) {
                result = (result << 8) | FourCharCode(char)
            }
            return result
        }
    }
    
}
