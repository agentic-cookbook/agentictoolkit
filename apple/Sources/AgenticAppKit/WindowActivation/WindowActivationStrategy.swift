import Foundation

/// One step in the activation cascade. Each strategy answers two questions:
/// whether it applies to a given target, and whether it succeeded in bringing
/// the target's window to the front.
///
/// `WindowActivationTester` runs strategies in order, stopping on the first
/// success. Strategies that don't apply are skipped silently.
public protocol WindowActivationStrategy: Sendable {

    /// Short human-readable label for log output (e.g. "iTerm TTY").
    var name: String { get }

    /// Whether this strategy is worth attempting for the given target. Use to
    /// gate by `termProgram`, presence of a PID, etc. Returning false here
    /// suppresses the strategy entirely (no FAILED log line).
    func appliesTo(_ target: WindowActivationTarget) -> Bool

    /// Attempt activation. Return `true` if the front window now belongs to
    /// the target. Strategies append diagnostics to `log`.
    func activate(_ target: WindowActivationTarget, log: ActivationTestLog) -> Bool
}
