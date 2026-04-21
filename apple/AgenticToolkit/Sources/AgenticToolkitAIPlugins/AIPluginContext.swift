import Foundation
import os

/// Context provided to a plugin on initialization.
public struct AIPluginContext: Sendable {
    public let logger: Logger
    public let dataDirectory: URL

    public init(logger: Logger, dataDirectory: URL) {
        self.logger = logger
        self.dataDirectory = dataDirectory
    }
}
