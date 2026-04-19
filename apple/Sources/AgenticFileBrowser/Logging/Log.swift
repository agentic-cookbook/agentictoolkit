import os

enum Log {
    private static let subsystem = "com.agentictoolkit.filebrowser"
    static let fileTree = Logger(subsystem: subsystem, category: "filetree")
    static let ui = Logger(subsystem: subsystem, category: "ui")
    static let workspace = Logger(subsystem: subsystem, category: "workspace")
    static let ide = Logger(subsystem: subsystem, category: "ide")
}
