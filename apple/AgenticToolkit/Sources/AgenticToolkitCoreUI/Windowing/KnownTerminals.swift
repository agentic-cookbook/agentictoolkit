import Foundation

/// Canonical catalog of terminal applications the toolkit knows how to
/// enumerate, match by `$TERM_PROGRAM`, and activate. Single source of truth
/// shared by `WindowActivationTester` (for enumeration diagnostics) and
/// `BringTerminalToFrontStrategy` (for activation).
public struct KnownTerminal: Sendable, Equatable {

    /// Human-readable name used in log output.
    public let displayName: String

    /// macOS bundle identifier used to look up a running instance.
    public let bundleID: String

    /// The values of `$TERM_PROGRAM` that identify this terminal. A single
    /// terminal may expose more than one (e.g. distribution variants).
    public let termProgramValues: [String]

    public init(displayName: String, bundleID: String, termProgramValues: [String]) {
        self.displayName = displayName
        self.bundleID = bundleID
        self.termProgramValues = termProgramValues
    }
}

public enum KnownTerminals {

    /// Every terminal the toolkit knows about. Callers can add their own
    /// entries by constructing a custom list; the default list covers the
    /// common macOS terminals.
    public static let all: [KnownTerminal] = [
        KnownTerminal(displayName: "iTerm2",
                      bundleID: "com.googlecode.iterm2",
                      termProgramValues: ["iTerm.app"]),
        KnownTerminal(displayName: "Terminal.app",
                      bundleID: "com.apple.Terminal",
                      termProgramValues: ["Apple_Terminal"]),
        KnownTerminal(displayName: "Warp",
                      bundleID: "dev.warp.Warp-Stable",
                      termProgramValues: ["WarpTerminal"]),
        KnownTerminal(displayName: "VS Code",
                      bundleID: "com.microsoft.VSCode",
                      termProgramValues: ["vscode"]),
    ]

    /// Returns the known terminal whose `termProgramValues` contains `termProgram`,
    /// or nil if unknown.
    public static func match(termProgram: String, in catalog: [KnownTerminal] = all) -> KnownTerminal? {
        catalog.first { $0.termProgramValues.contains(termProgram) }
    }
}
