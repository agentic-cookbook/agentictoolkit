import Foundation

/// A fully-described request for one chat turn, returned by a plugin's
/// `buildRequest`. The plugin contributes only the description; the host owns the
/// transport. A request reaches the provider one of two ways — over HTTP, or by
/// running a local command — and the host drives whichever the plugin chose.
///
/// The split lives here, in the request, rather than in the plugin's identity:
/// every plugin is the same tiny "describe a request, decode the bytes" shape,
/// and only the `Transport` case differs. The decoder (`AIPlugin.makeDecoder`) is
/// transport-agnostic — it turns bytes into events whether they came from an
/// HTTP response body or a subprocess's stdout.
public struct AIRequestSpec: Sendable {

    public enum Method: String, Sendable {
        case get = "GET"
        case post = "POST"
    }

    /// How the host should reach the provider for this request.
    public enum Transport: Sendable {

        /// An HTTP request the host performs with `URLSession`, streaming the
        /// response body to the decoder.
        case http(method: Method, url: URL, headers: [String: String], body: Data?)

        /// A local command the host runs as a subprocess: `stdin` (if any) is
        /// written to the process, and its stdout is streamed to the decoder.
        case command(executableURL: URL, arguments: [String], stdin: Data?, environment: [String: String])
    }

    public var transport: Transport

    /// Wall-clock budget for the whole request before the host cancels it.
    public var timeout: TimeInterval

    public init(transport: Transport, timeout: TimeInterval = 120) {
        self.transport = transport
        self.timeout = timeout
    }

    /// Convenience constructor for the common HTTP case.
    public static func http(
        method: Method = .post,
        url: URL,
        headers: [String: String] = [:],
        body: Data? = nil,
        timeout: TimeInterval = 120
    ) -> AIRequestSpec {
        AIRequestSpec(transport: .http(method: method, url: url, headers: headers, body: body), timeout: timeout)
    }

    /// Convenience constructor for the subprocess case.
    public static func command(
        executableURL: URL,
        arguments: [String] = [],
        stdin: Data? = nil,
        environment: [String: String] = [:],
        timeout: TimeInterval = 120
    ) -> AIRequestSpec {
        AIRequestSpec(
            transport: .command(
                executableURL: executableURL,
                arguments: arguments,
                stdin: stdin,
                environment: environment
            ),
            timeout: timeout
        )
    }
}
