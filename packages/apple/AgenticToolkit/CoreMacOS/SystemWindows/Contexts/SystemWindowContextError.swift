import Foundation

/// Errors that can occur during system-window context management operations.
public enum SystemWindowContextError: Error, LocalizedError {
    /// No context exists with the given ID.
    case contextNotFound(id: UUID)

    /// Attempted to switch to the already-active context.
    case alreadyActiveContext(id: UUID)

    /// The window is already assigned to a context.
    case windowAlreadyAssigned(windowID: UInt32, contextName: String)

    /// No window with the given CGWindowID was found among live windows.
    case windowNotFound(windowID: UInt32)

    /// No context is currently active.
    case noActiveContext

    /// The window is not assigned to any context.
    case windowNotInAnyContext(windowID: UInt32)

    /// State persistence failed.
    case persistenceFailed(underlying: Error)

    public var errorDescription: String? {
        switch self {
        case .contextNotFound(let id):
            return "Context not found: \(id)"
        case .alreadyActiveContext(let id):
            return "Context \(id) is already active"
        case .windowAlreadyAssigned(let windowID, let contextName):
            return "Window \(windowID) is already assigned to context '\(contextName)'"
        case .windowNotFound(let windowID):
            return "No window found with CGWindowID \(windowID)"
        case .noActiveContext:
            return "No context is currently active"
        case .windowNotInAnyContext(let windowID):
            return "Window \(windowID) is not assigned to any context"
        case .persistenceFailed(let underlying):
            return "Failed to persist state: \(underlying.localizedDescription)"
        }
    }
}
