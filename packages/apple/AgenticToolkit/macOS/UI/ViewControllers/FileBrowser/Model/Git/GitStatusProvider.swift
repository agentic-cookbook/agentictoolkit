import AgenticToolkitCore
import Foundation
import os

public final class GitStatusProvider: @unchecked Sendable {
    private let repoRoot: URL
    private var requestID: UUID?

    public init(repoRoot: URL) {
        self.repoRoot = repoRoot
    }

    public func refresh(
        completion: @escaping @Sendable (
            _ fileStatuses: [String: GitFileStatus],
            _ dirStatuses: [String: GitFileStatus]
        ) -> Void
    ) {
        let requestID = UUID()
        self.requestID = requestID

        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            guard let self = self else { return }

            let process = Process()
            process.executableURL = URL(fileURLWithPath: "/usr/bin/git")
            process.arguments = ["status", "--porcelain=v1", "-uall", "--ignore-submodules"]
            process.currentDirectoryURL = self.repoRoot

            let pipe = Pipe()
            process.standardOutput = pipe
            process.standardError = Pipe()

            do {
                try process.run()
            } catch {
                self.logger.error("Failed to run git status: \(error.localizedDescription)")
                DispatchQueue.main.async { completion([:], [:]) }
                return
            }

            // 5-second timeout
            let timeout = DispatchWorkItem { if process.isRunning { process.terminate() } }
            DispatchQueue.global().asyncAfter(deadline: .now() + 5, execute: timeout)
            process.waitUntilExit()
            timeout.cancel()

            let data = pipe.fileHandleForReading.readDataToEndOfFile()
            let output = String(data: data, encoding: .utf8) ?? ""

            guard self.requestID == requestID else { return }  // stale

            let (fileStatuses, dirStatuses) = Self.parse(porcelain: output)

            self.logger.info("Git status: \(fileStatuses.count) files, \(dirStatuses.count) directories")

            DispatchQueue.main.async {
                guard self.requestID == requestID else { return }
                completion(fileStatuses, dirStatuses)
            }
        }
    }

    /// Parses `git status --porcelain=v1` output into file and directory status maps.
    public static func parse(
        porcelain output: String
    ) -> (files: [String: GitFileStatus], dirs: [String: GitFileStatus]) {
        var fileStatuses: [String: GitFileStatus] = [:]

        for line in output.split(separator: "\n", omittingEmptySubsequences: true) {
            guard line.count >= 3 else { continue }
            let statusChars = String(line.prefix(2))
            let filePath = String(line.dropFirst(3))

            let indexStatus = statusChars.first ?? " "
            let workTreeStatus = statusChars.last ?? " "

            let status: GitFileStatus?
            if indexStatus == "?" || workTreeStatus == "?" {
                status = .untracked
            } else if indexStatus == "U" || workTreeStatus == "U" {
                status = .conflicted
            } else if indexStatus == "!" || workTreeStatus == "!" {
                status = .ignored
            } else if workTreeStatus == "M" || indexStatus == "M" {
                status = .modified
            } else if workTreeStatus == "A" || indexStatus == "A" {
                status = .added
            } else if workTreeStatus == "D" || indexStatus == "D" {
                status = .deleted
            } else if indexStatus == "R" {
                status = .renamed
                if let arrowRange = filePath.range(of: " -> ") {
                    let newPath = String(filePath[arrowRange.upperBound...])
                    fileStatuses[newPath] = status
                    continue
                }
            } else {
                status = nil
            }

            if let resolved = status {
                fileStatuses[filePath] = resolved
            }
        }

        var dirStatuses: [String: GitFileStatus] = [:]
        for (path, status) in fileStatuses {
            var components = path.split(separator: "/")
            components.removeLast()
            var dirPath = ""
            for component in components {
                dirPath += (dirPath.isEmpty ? "" : "/") + component
                let existing = dirStatuses[dirPath]
                if existing == nil || status.priority > (existing?.priority ?? -1) {
                    dirStatuses[dirPath] = status
                }
            }
        }

        return (fileStatuses, dirStatuses)
    }
}

extension GitStatusProvider: Loggable {
    public static nonisolated let logger = makeLogger()
}
