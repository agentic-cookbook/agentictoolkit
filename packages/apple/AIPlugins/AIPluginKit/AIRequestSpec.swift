import Foundation

/// A fully-described HTTP request, returned by a plugin's `buildRequest`. The
/// host turns this into a `URLRequest` and performs the networking itself — the
/// plugin contributes only the description, never the transport.
public struct AIRequestSpec: Sendable {

    public enum Method: String, Sendable {
        case get = "GET"
        case post = "POST"
    }

    public var method: Method
    public var url: URL
    public var headers: [String: String]
    public var body: Data?
    public var timeout: TimeInterval

    public init(
        method: Method = .post,
        url: URL,
        headers: [String: String] = [:],
        body: Data? = nil,
        timeout: TimeInterval = 120
    ) {
        self.method = method
        self.url = url
        self.headers = headers
        self.body = body
        self.timeout = timeout
    }
}
