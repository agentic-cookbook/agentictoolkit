import Foundation

/// Credentials passed to a plugin for authentication.
public struct AIPluginCredentials: Sendable {
    public let apiKey: String
    public let baseURL: String?

    public init(apiKey: String, baseURL: String? = nil) {
        self.apiKey = apiKey
        self.baseURL = baseURL
    }
}
