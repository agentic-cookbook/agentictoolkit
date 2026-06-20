import Foundation

/// Runs `claude -p` (the Claude Code CLI in print mode) to get a model reply without an
/// API key — it reuses the user's Claude Code login. Foundation-only and provider-shaped
/// so both the in-app `SessionSummarizer` and the daemon's `DaemonSessionSummarizer` share
/// one robust implementation instead of each copying the Process/Pipe plumbing.
public enum ClaudeCLI {

    public enum CLIError: Error, LocalizedError, Sendable {
        case binaryNotFound
        case launchFailed(String)
        case nonZeroExit(code: Int32, stderr: String)
        case emptyReply

        public var errorDescription: String? {
            switch self {
            case .binaryNotFound:
                return "Claude CLI not found (install Claude Code or check your PATH)"
            case .launchFailed(let message):
                return "Failed to launch claude: \(message)"
            case .nonZeroExit(let code, let stderr):
                return "claude -p failed: \(stderr.isEmpty ? "exit \(code)" : String(stderr.prefix(200)))"
            case .emptyReply:
                return "Empty reply from claude -p"
            }
        }
    }

    /// Common install locations for the `claude` binary, in priority order.
    public static func findBinary() -> String? {
        let candidates = [
            FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent(".local/bin/claude").path,
            "/usr/local/bin/claude",
            "/opt/homebrew/bin/claude"
        ]
        return candidates.first { FileManager.default.isExecutableFile(atPath: $0) }
    }

    /// Runs `claude -p` with `prompt` on stdin and returns trimmed stdout.
    ///
    /// Robustness: stdout/stderr are drained CONCURRENTLY with the run (a child writing
    /// more than the ~64KB pipe buffer would otherwise deadlock against the wait), the wait
    /// happens off the cooperative pool (so a slow reply doesn't pin a concurrency thread),
    /// and stdin is written with the throwing API so a broken pipe can't raise an
    /// uncatchable Obj-C exception. An empty `model` omits `--model` (claude's default).
    public static func run(
        prompt: String,
        systemPrompt: String,
        model: String,
        timeout: TimeInterval
    ) async throws -> String {
        guard let claudePath = findBinary() else { throw CLIError.binaryNotFound }

        let process = Process()
        process.executableURL = URL(fileURLWithPath: claudePath)
        var args = ["-p", "--system-prompt", systemPrompt]
        if !model.isEmpty { args += ["--model", model] }
        process.arguments = args

        let stdinPipe = Pipe(), stdoutPipe = Pipe(), stderrPipe = Pipe()
        process.standardInput = stdinPipe
        process.standardOutput = stdoutPipe
        process.standardError = stderrPipe

        var env = ProcessInfo.processInfo.environment
        let home = FileManager.default.homeDirectoryForCurrentUser.path
        let extras = ["\(home)/.local/bin", "/usr/local/bin", "/opt/homebrew/bin"]
        env["PATH"] = (extras + [env["PATH"] ?? "/usr/bin:/bin"]).joined(separator: ":")
        // Mark this as a programmatic/headless claude invocation so a session
        // tracker's hooks (which this child process inherits) can tell it apart
        // from a real interactive user session and not record it — e.g.
        // stenographer's EnvelopeBuilder drops events carrying this marker.
        env["AGENTIC_TOOLKIT_HEADLESS"] = "1"
        process.environment = env

        do {
            try process.run()
        } catch {
            throw CLIError.launchFailed(error.localizedDescription)
        }

        // A dead child closes the pipe; the legacy non-throwing write(_:) would raise an
        // uncatchable Obj-C exception on the broken pipe. A closed pipe here is benign.
        do {
            try stdinPipe.fileHandleForWriting.write(contentsOf: Data(prompt.utf8))
            try stdinPipe.fileHandleForWriting.close()
        } catch {
            // Child exited before reading stdin — read whatever it emitted.
        }

        let timeoutTask = Task {
            try? await Task.sleep(for: .seconds(timeout))
            if process.isRunning { process.terminate() }
        }
        async let stdoutData = readToEnd(stdoutPipe.fileHandleForReading)
        async let stderrData = readToEnd(stderrPipe.fileHandleForReading)
        await waitForExit(process)
        timeoutTask.cancel()

        let reply = (String(data: await stdoutData, encoding: .utf8) ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let stderr = (String(data: await stderrData, encoding: .utf8) ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)

        guard process.terminationStatus == 0 else {
            throw CLIError.nonZeroExit(code: process.terminationStatus, stderr: stderr)
        }
        guard !reply.isEmpty else { throw CLIError.emptyReply }
        return reply
    }

    /// Reads a file handle to EOF on a background queue — concurrent with the child, never
    /// blocking a Swift concurrency thread.
    private static func readToEnd(_ handle: FileHandle) async -> Data {
        await withCheckedContinuation { (continuation: CheckedContinuation<Data, Never>) in
            DispatchQueue.global(qos: .utility).async {
                continuation.resume(returning: (try? handle.readToEnd()) ?? Data())
            }
        }
    }

    /// Awaits process exit off the cooperative pool (`waitUntilExit()` blocks its thread).
    private static func waitForExit(_ process: Process) async {
        await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
            DispatchQueue.global(qos: .utility).async {
                process.waitUntilExit()
                continuation.resume()
            }
        }
    }
}
