import Foundation

/// Common errors for HTTP-based plugin requests.
public enum AIPluginRequestError: Error, LocalizedError {
    case invalidResponse
    case invalidURL
    case missingBaseURL
    case httpError(Int, String?)

    public var errorDescription: String? {
        switch self {
        case .invalidResponse:
            return "Invalid server response"
        case .invalidURL:
            return "Invalid API URL"
        case .missingBaseURL:
            return "Base URL is required"
        case .httpError(let code, let message):
            if let message {
                return "HTTP \(code): \(message)"
            }
            return "HTTP \(code)"
        }
    }
}
