import Foundation

/// A window the tester should attempt to activate. App-agnostic value object.
///
/// The tester uses these fields in its activation strategies:
/// - `pid` to resolve the TTY (iTerm2 session matching)
/// - `termProgram` to pick the terminal bundle ID
/// - `projectName` and `cwd` for accessibility-API title matching
public struct WindowActivationTarget: Sendable, Equatable {
    /// Human-readable identifier for the target (shown in logs).
    public let identifier: String

    /// Display name used for AX title matching (e.g. a project name).
    public let projectName: String

    /// Working directory of the target process; used for AX title matching.
    public let cwd: String

    /// POSIX process ID of the target; used to resolve the TTY.
    public let pid: Int32

    /// The `$TERM_PROGRAM` value of the process (e.g. "iTerm.app",
    /// "Apple_Terminal", "WarpTerminal", "vscode"). Empty string if unknown.
    public let termProgram: String

    public init(
        identifier: String,
        projectName: String,
        cwd: String,
        pid: Int32,
        termProgram: String
    ) {
        self.identifier = identifier
        self.projectName = projectName
        self.cwd = cwd
        self.pid = pid
        self.termProgram = termProgram
    }
}
