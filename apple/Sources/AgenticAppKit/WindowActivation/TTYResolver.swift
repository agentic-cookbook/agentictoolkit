import Foundation

/// Shells out to `ps -p <pid> -o tty=` to find the controlling TTY for a process.
///
/// Returned strings look like `s001` (no `/dev/` prefix). Callers needing the
/// device path can prepend `/dev/` themselves.
enum TTYResolver {

    /// Returns the controlling TTY for the given PID, or nil if the process is
    /// gone, has no TTY, or `ps` failed.
    static func tty(forPID pid: Int32) -> String? {
        guard pid > 0 else { return nil }
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/bin/ps")
        process.arguments = ["-p", "\(pid)", "-o", "tty="]
        let pipe = Pipe()
        process.standardOutput = pipe
        process.standardError = FileHandle.nullDevice

        do {
            try process.run()
            process.waitUntilExit()
            let data = pipe.fileHandleForReading.readDataToEndOfFile()
            let tty = String(data: data, encoding: .utf8)?
                .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            return tty.isEmpty ? nil : tty
        } catch {
            return nil
        }
    }
}
