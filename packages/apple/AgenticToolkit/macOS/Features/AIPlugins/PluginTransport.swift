import Foundation
import AIPluginKit

/// Drives one `AIRequestSpec` to completion and streams the decoded
/// `AIStreamEvent`s, regardless of whether the plugin chose HTTP or a local
/// subprocess. The plugin *describes* the request and *decodes* the bytes; this
/// type owns the actual I/O — it is the one place in the system that performs
/// networking or spawns a process.
///
/// The decoder (`AIPlugin.makeDecoder`) is created *inside* the streaming task:
/// it is not `Sendable` and holds per-response parsing state, so it must never
/// be shared. The plugin itself is `Sendable`, so capturing it is safe.
enum PluginTransport {

    /// A provider-level failure raised after the plugin described the request:
    /// a non-2xx HTTP response or a non-zero subprocess exit. The message is the
    /// plugin's own `describeError` text when it offers one, else a generic
    /// fallback.
    enum TransportError: Error, LocalizedError {
        case http(status: Int, message: String)
        case commandFailed(status: Int32, message: String)
        case invalidResponse

        var errorDescription: String? {
            switch self {
            case .http(_, let message): return message
            case .commandFailed(_, let message): return message
            case .invalidResponse: return "The server returned an invalid response."
            }
        }
    }

    /// Performs `spec` and streams decoded events. Cancelling the consuming task
    /// cancels the underlying transfer or terminates the subprocess.
    static func run(spec: AIRequestSpec, plugin: any AIPlugin) -> AsyncThrowingStream<AIStreamEvent, Error> {
        AsyncThrowingStream { continuation in
            let task = Task {
                do {
                    switch spec.transport {
                    case let .http(method, url, headers, body):
                        try await runHTTP(
                            method: method, url: url, headers: headers, body: body,
                            timeout: spec.timeout, plugin: plugin, into: continuation
                        )
                    case let .command(executableURL, arguments, stdin, environment):
                        try await runCommand(
                            executableURL: executableURL, arguments: arguments,
                            stdin: stdin, environment: environment,
                            plugin: plugin, into: continuation
                        )
                    }
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }

    // MARK: - HTTP

    private static func runHTTP(
        method: AIRequestSpec.Method,
        url: URL,
        headers: [String: String],
        body: Data?,
        timeout: TimeInterval,
        plugin: any AIPlugin,
        into continuation: AsyncThrowingStream<AIStreamEvent, Error>.Continuation
    ) async throws {
        var request = URLRequest(url: url, timeoutInterval: timeout)
        request.httpMethod = method.rawValue
        for (key, value) in headers {
            request.setValue(value, forHTTPHeaderField: key)
        }
        request.httpBody = body

        let (bytes, response) = try await URLSession.shared.bytes(for: request)

        guard let http = response as? HTTPURLResponse else {
            throw TransportError.invalidResponse
        }

        guard (200..<300).contains(http.statusCode) else {
            // Drain the body so the plugin can describe the error.
            var errorBody = Data()
            for try await byte in bytes { errorBody.append(byte) }
            let message = plugin.describeError(status: http.statusCode, body: errorBody)
                ?? "HTTP \(http.statusCode)"
            throw TransportError.http(status: http.statusCode, message: message)
        }

        try await pump(bytes: bytes, through: plugin.makeDecoder(), into: continuation)
    }

    // MARK: - Command

    private static func runCommand(
        executableURL: URL,
        arguments: [String],
        stdin: Data?,
        environment: [String: String],
        plugin: any AIPlugin,
        into continuation: AsyncThrowingStream<AIStreamEvent, Error>.Continuation
    ) async throws {
        let process = Process()
        process.executableURL = executableURL
        process.arguments = arguments
        if !environment.isEmpty { process.environment = environment }

        let stdoutPipe = Pipe()
        let stderrPipe = Pipe()
        let stdinPipe = Pipe()
        process.standardOutput = stdoutPipe
        process.standardError = stderrPipe
        process.standardInput = stdinPipe

        try process.run()
        // Cancellation (or any thrown error) terminates a still-running child.
        defer { if process.isRunning { process.terminate() } }

        // Feed stdin, then close it so the child sees EOF and can finish.
        if let stdin { stdinPipe.fileHandleForWriting.write(stdin) }
        try? stdinPipe.fileHandleForWriting.close()

        try await pump(bytes: stdoutPipe.fileHandleForReading.bytes, through: plugin.makeDecoder(), into: continuation)

        process.waitUntilExit()
        guard process.terminationStatus == 0 else {
            let errorBody = stderrPipe.fileHandleForReading.readDataToEndOfFile()
            let message = plugin.describeError(status: Int(process.terminationStatus), body: errorBody)
                ?? "Command exited with status \(process.terminationStatus)"
            throw TransportError.commandFailed(status: process.terminationStatus, message: message)
        }
    }

    // MARK: - Byte pump

    /// Accumulates a byte stream into newline-terminated frames and feeds each to
    /// the decoder, yielding whatever events come back. Line-oriented wire
    /// formats (SSE, JSONL) decode a frame per newline; the decoder buffers any
    /// partial trailing frame itself, so the final remainder plus `finish()` flush
    /// anything left over.
    private static func pump<Bytes: AsyncSequence>(
        bytes: Bytes,
        through decoder: any AIStreamDecoder,
        into continuation: AsyncThrowingStream<AIStreamEvent, Error>.Continuation
    ) async throws where Bytes.Element == UInt8 {
        var line = Data()
        for try await byte in bytes {
            try Task.checkCancellation()
            line.append(byte)
            if byte == 0x0A {
                for event in decoder.consume(line) { continuation.yield(event) }
                line.removeAll(keepingCapacity: true)
            }
        }
        if !line.isEmpty {
            for event in decoder.consume(line) { continuation.yield(event) }
        }
        for event in decoder.finish() { continuation.yield(event) }
    }
}
