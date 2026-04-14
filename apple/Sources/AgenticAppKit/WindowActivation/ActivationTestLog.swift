import Foundation

/// Thread-safe append-only log for window activation test runs. Writes to both
/// an in-memory buffer and a file under the given Application Support subdirectory.
///
/// Not a singleton — create one per test run or per app. The log path is derived
/// from the init-time `appSupportSubdirectory` name.
public final class ActivationTestLog {

    private let queue = DispatchQueue(label: "AgenticAppKit.ActivationTestLog")
    private var _entries: [String] = []
    private let logURL: URL

    /// Creates a log that writes to
    /// `~/Library/Application Support/<appSupportSubdirectory>/activation-test.log`.
    public init(appSupportSubdirectory: String) {
        let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        let dir = appSupport.appendingPathComponent(appSupportSubdirectory)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        self.logURL = dir.appendingPathComponent("activation-test.log")
    }

    /// Appends a timestamped entry. Safe to call from any thread.
    public func append(_ message: String) {
        let timestamp = ISO8601DateFormatter().string(from: Date())
        let line = "[\(timestamp)] \(message)"
        queue.sync { _entries.append(line) }
        appendToFile(line)
    }

    /// Empties both the in-memory buffer and the file.
    public func clear() {
        queue.sync { _entries.removeAll() }
        try? "".write(to: logURL, atomically: true, encoding: .utf8)
    }

    /// The current log contents joined by newlines.
    public var text: String {
        queue.sync { _entries.joined(separator: "\n") }
    }

    /// The on-disk path to the log file.
    public var logPath: String { logURL.path }

    // MARK: - Private

    private func appendToFile(_ line: String) {
        if let handle = try? FileHandle(forWritingTo: logURL) {
            handle.seekToEndOfFile()
            handle.write(Data((line + "\n").utf8))
            handle.closeFile()
        } else {
            try? (line + "\n").write(to: logURL, atomically: true, encoding: .utf8)
        }
    }
}
