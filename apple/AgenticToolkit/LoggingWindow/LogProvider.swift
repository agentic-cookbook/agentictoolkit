import Foundation

/// A scrollable-log backing store with a fixed column layout.
///
/// Producers (an SSE subscription, a file tail, a test fixture …) push
/// ``LogLine``s via `append` / `replace` / `clear`. The attached
/// ``LogProviderDelegate`` — typically a ``LogView`` — is notified of
/// every mutation and is expected to refresh its display accordingly.
@MainActor
public protocol LogProvider: AnyObject {
    /// Column layout. Expected to be stable for the lifetime of the
    /// provider; ``LogView`` captures it at init time.
    var columns: [LogColumn] { get }

    /// Current rows, oldest first. `lines.count` tracks the FIFO cap
    /// set by ``maxLines``.
    var lines: [LogLine] { get }

    /// Upper bound on retained rows. Once exceeded, the oldest rows
    /// are dropped on append. `Int.max` for unbounded logs.
    var maxLines: Int { get }

    /// Observer (typically the view). Weak ref — the delegate owns
    /// its own lifecycle.
    var delegate: LogProviderDelegate? { get set }

    func append(_ line: LogLine)
    func append(contentsOf lines: [LogLine])
    func replace(with lines: [LogLine])
    func clear()
}

@MainActor
public protocol LogProviderDelegate: AnyObject {
    func logProvider(_ provider: any LogProvider, didChange change: LogChange)
}

/// The kind of mutation that just happened.
///
/// `appended(count:)` carries how many rows were added in the latest
/// batch — the view can use this to compute the newly-inserted range
/// without diffing. `replaced` means the whole buffer was swapped (use
/// `reloadData()`). `cleared` means the buffer is now empty.
public enum LogChange: Equatable {
    case appended(count: Int)
    case replaced
    case cleared
}
