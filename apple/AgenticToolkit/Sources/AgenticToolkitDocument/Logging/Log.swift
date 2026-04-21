import os

enum Log {
    private static let subsystem = "com.agentictoolkit.documentkit"
    static let document = Logger(subsystem: subsystem, category: "document")
    static let project = Logger(subsystem: subsystem, category: "project")
    static let workspace = Logger(subsystem: subsystem, category: "workspace")
}
