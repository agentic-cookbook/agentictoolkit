import Foundation

/// Thread-safe append-only log for window activation test runs. Writes to both
/// an in-memory buffer and a file under the given Application Support subdirectory.
///
/// Not a singleton — create one per test run or per app. The log path is derived
/// from the init-time `appSupportSubdirectory` name.
public final class ActivationTestLog: @unchecked Sendable {

    private let queue = DispatchQueue(label: "AgenticAppKit.ActivationTestLog")
    private var _entries: [String] = []

    /// Where (if anywhere) entries are mirrored to disk. `nil` for in-memory-only logs.
    private let logURL: URL?

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
    public convenience init(appSupportSubdirectory: String) {
        let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
        let url: URL?
        if let appSupport {
            let dir = appSupport.appendingPathComponent(appSupportSubdirectory)
            try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
            url = dir.appendingPathComponent("activation-test.log")
        } else {
            url = nil
        }
        self.init(fileURL: url)
    }

    /// Creates a log that mirrors entries to the given file URL, or to memory only
    /// if `fileURL` is nil. Useful for tests that want to assert on `text`
    /// without writing to disk, and for callers that want full control over
    /// the log path.
    public init(fileURL: URL?) {
        self.logURL = fileURL
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

    /// Empties both the in-memory buffer and (if present) the file.
    public func clear() {
        queue.sync { _entries.removeAll() }
        if let logURL {
            try? "".write(to: logURL, atomically: true, encoding: .utf8)
        }
    }

    /// The current log contents: each entry followed by a trailing newline, to
    /// match the on-disk file format exactly (`text` and the file contents are
    /// byte-identical when both have seen the same append sequence).
    public var text: String {
        queue.sync {
            guard !_entries.isEmpty else { return "" }
            return _entries.map { $0 + "\n" }.joined()
        }
    }

    /// The on-disk path to the log file, or nil if this log is in-memory only.
    public var logPath: String? { logURL?.path }

    // MARK: - Private

    /// Appends a line to the log file, creating it if it doesn't yet exist.
    /// Never overwrites existing content — if the file exists but can't be
    /// opened for append, the write is dropped rather than truncating history.
    /// No-op if this log was constructed without a file URL.
    private func appendToFile(_ line: String) {
        guard let logURL else { return }
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
