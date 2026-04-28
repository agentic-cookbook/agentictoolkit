import Foundation
import CoreServices
import os
import AgenticToolkitCore
import AgenticToolkitCoreUI
import AgenticToolkitCoreMacOS

public final class FileSystemWatcher: @unchecked Sendable {
    public typealias ChangeHandler = @Sendable (_ changedPaths: [String]) -> Void

    private var streamRef: FSEventStreamRef?
    private let rootPath: String
    private let excludedPrefixes: [String]
    private let handler: ChangeHandler
    private let queue = DispatchQueue(label: "com.agentictoolkit.filebrowser.fswatcher", qos: .utility)

    public init(rootPath: String, excludedPrefixes: [String], handler: @escaping ChangeHandler) {
        self.rootPath = rootPath
        self.excludedPrefixes = excludedPrefixes
        self.handler = handler
    }

    public func start() {
        guard streamRef == nil else { return }

        var context = FSEventStreamContext()
        context.info = Unmanaged.passUnretained(self).toOpaque()

        let callback: FSEventStreamCallback = { streamRef, clientCallBackInfo, numEvents, eventPaths, eventFlags, eventIds in
            guard let info = clientCallBackInfo else { return }
            let watcher = Unmanaged<FileSystemWatcher>.fromOpaque(info).takeUnretainedValue()

            let paths = unsafeBitCast(eventPaths, to: NSArray.self) as! [String]
            let filtered = paths.filter { path in
                !watcher.excludedPrefixes.contains(where: { path.hasPrefix($0) })
            }

            guard !filtered.isEmpty else { return }
            let handler = watcher.handler
            DispatchQueue.main.async {
                handler(filtered)
            }
        }

        let pathsToWatch = [rootPath] as CFArray
        streamRef = FSEventStreamCreate(
            nil, callback, &context,
            pathsToWatch, FSEventStreamEventId(kFSEventStreamEventIdSinceNow),
            0.5,
            UInt32(kFSEventStreamCreateFlagFileEvents | kFSEventStreamCreateFlagUseCFTypes)
        )

        guard let stream = streamRef else {
            logger.error("Failed to create FSEvent stream for \(self.rootPath)")
            return
        }

        FSEventStreamSetDispatchQueue(stream, queue)
        FSEventStreamStart(stream)
        logger.info("Started file system watcher for \(self.rootPath, privacy: .public)")
    }

    public func stop() {
        guard let stream = streamRef else { return }
        FSEventStreamStop(stream)
        FSEventStreamInvalidate(stream)
        FSEventStreamRelease(stream)
        streamRef = nil
        logger.info("Stopped file system watcher")
    }

    deinit { stop() }
}

extension FileSystemWatcher: Loggable {
    public static nonisolated let logger = makeLogger()
}
