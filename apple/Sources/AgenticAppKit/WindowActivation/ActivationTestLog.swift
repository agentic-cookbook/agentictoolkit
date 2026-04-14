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

    /// Reused per-instance formatter — `ISO8601DateFormatter` is expensive to construct.
    /// Access is serialized through `queue`.
    private let timestampFormatter: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    /// Creates a log that writes to
    /// `~/Library/Application Support/<appSupportSubdirectory>/activation-test.log`.
    ///
    /// If the Application Support directory cannot be located, logging becomes
    /// in-memory only (file writes silently no-op) rather than crashing.
    public init(appSupportSubdirectory: String) {
        let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
        if let appSupport {
            let dir = appSupport.appendingPathComponent(appSupportSubdirectory)
            try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
            self.logURL = dir.appendingPathComponent("activation-test.log")
        } else {
            // Fall back to a tmp path. File writes will likely still succeed;
            // if not, appendToFile handles the failure honestly.
            self.logURL = URL(fileURLWithPath: NSTemporaryDirectory())
                .appendingPathComponent("activation-test.log")
        }
    }

    /// Appends a timestamped entry. Safe to call from any thread.
    public func append(_ message: String) {
        let now = Date()
        let line = queue.sync { () -> String in
            let timestamp = self.timestampFormatter.string(from: now)
            let l = "[\(timestamp)] \(message)"
            _entries.append(l)
            return l
        }
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

    /// Appends a line to the log file, creating it if it doesn't yet exist.
    /// Never overwrites existing content — if the file exists but can't be
    /// opened for append, the write is dropped rather than truncating history.
    private func appendToFile(_ line: String) {
        let data = Data((line + "\n").utf8)

        // Create the file on first write.
        if !FileManager.default.fileExists(atPath: logURL.path) {
            try? data.write(to: logURL, options: .atomic)
            return
        }

        // File exists — append only. If the handle can't be obtained, drop the
        // write rather than silently truncating the existing log.
        guard let handle = try? FileHandle(forWritingTo: logURL) else { return }
        defer { try? handle.close() }
        do {
            try handle.seekToEnd()
            try handle.write(contentsOf: data)
        } catch {
            // Write failure — can't do anything safe from here without risking
            // data loss. Drop this line.
        }
    }
}
