import Foundation

/// Walks a directory tree looking for git working trees.
///
/// The rules are the ones `proj projects` settled on, for the same reasons:
///
/// - **Hidden directories are never descended into.** One rule covers `.git`,
///   `.venv`, `.build`, `.claude/worktrees` and every other dot-directory that
///   holds checkouts nobody means by "my projects".
/// - **Folders matching a skip pattern are skipped directly under a scan root**
///   — `Library`, the media libraries, and the cloud-sync folders. None is
///   hidden, and each is either someone else's vendored checkouts or a
///   synced mirror big enough to dominate the walk. The list is the user's:
///   `rootSkipPatterns` is injected, and the app feeds it from a setting.
/// - **A directory holding `.git` is a repository, and is not descended into.**
///   That is also what excludes submodules: they live inside a repository.
/// - **A directory whose `.git` is a *file* is skipped entirely** — that is an
///   absorbed submodule or a linked worktree, neither of which is a project in
///   its own right.
///
/// Nothing here touches the main actor and nothing here is `git`: the remote is
/// read out of `.git/config` directly, because 200-odd `git config` subprocesses
/// cost more than the whole walk.
public struct GitRepoScanner: Sendable {

    /// Directories that never contain a project but often contain checkouts.
    /// Same set as `proj`'s, so the two agree about what a project is.
    public static let prunedDirectoryNames: Set<String> = [
        "node_modules", "venv", "__pycache__",
        "build", "dist", "target",
        "Pods", "Carthage"
    ]

    /// The starting skip list, offered to the user rather than imposed on them.
    ///
    /// Dropbox appears twice because it names its folder two ways: `Dropbox`
    /// for a personal account, `<Company> Dropbox` for a team one. A glob is
    /// the only way to cover the second, and the first is not a glob.
    public static let defaultRootSkipPatterns: [String] = [
        "Library",
        "Music",
        "Pictures",
        "Movies",
        "Dropbox",
        "* Dropbox",
        "Google Drive"
    ]

    public let roots: [URL]

    /// Matched — as `fnmatch` globs, case-insensitively — against the name of
    /// every folder found *directly* under a scan root. Further down, `Music`
    /// is just a folder someone named that, and may well be inside a project.
    public let rootSkipPatterns: [String]

    /// Defaults to the user's home directory, which is what the app scans.
    public init(
        roots: [URL]? = nil,
        rootSkipPatterns: [String] = GitRepoScanner.defaultRootSkipPatterns
    ) {
        self.roots = roots ?? [FileManager.default.homeDirectoryForCurrentUser]
        self.rootSkipPatterns = rootSkipPatterns
    }

    /// One folder name against one pattern, the way the scanner matches it.
    ///
    /// Public because the settings panel says out loud which of the user's
    /// folders a pattern currently excludes, and a second implementation of
    /// this would be a second answer to the same question (`dry`).
    public static func name(_ name: String, matches pattern: String) -> Bool {
        fnmatch(pattern, name, FNM_CASEFOLD) == 0
    }

    /// Reported as the walk goes, so the progress window has something truthful
    /// to say. Called from whatever thread `scan` runs on.
    public struct Progress: Sendable {
        public let directoriesVisited: Int
        public let reposFound: Int
        public let currentPath: String
    }

    /// Walks every root and returns what it found, sorted by path so two scans
    /// of an unchanged tree produce identical output (`idempotency`).
    ///
    /// `isCancelled` is consulted per directory. The scan is not cancellable
    /// from the UI today; the hook exists because the alternative is a walk that
    /// keeps running after the app is told to quit.
    public func scan(
        isCancelled: @Sendable () -> Bool = { false },
        onProgress: (@Sendable (Progress) -> Void)? = nil
    ) -> [ScannedGitRepo] {
        let fileManager = FileManager.default
        let keys: [URLResourceKey] = [.isDirectoryKey, .isSymbolicLinkKey, .nameKey]

        var found: [ScannedGitRepo] = []
        var visited = 0

        for root in roots {
            var stack: [(url: URL, depth: Int)] = [(root, 0)]

            while let entry = stack.popLast() {
                if isCancelled() { return found.sorted { $0.path < $1.path } }
                visited += 1
                onProgress?(Progress(
                    directoriesVisited: visited,
                    reposFound: found.count,
                    currentPath: entry.url.path
                ))

                let children: [URL]
                do {
                    children = try fileManager.contentsOfDirectory(
                        at: entry.url,
                        includingPropertiesForKeys: keys,
                        options: []
                    )
                } catch {
                    // An unreadable directory is not a reason to abandon the
                    // walk — `~` has plenty of them.
                    continue
                }

                if let dotGit = children.first(where: { $0.lastPathComponent == ".git" }) {
                    if isDirectory(dotGit) {
                        found.append(ScannedGitRepo(
                            path: entry.url.path,
                            remote: Self.originRemote(inGitDirectory: dotGit)
                        ))
                    }
                    // Repository or submodule/worktree, the subtree is done.
                    continue
                }

                for child in children where shouldDescend(into: child, atDepth: entry.depth + 1) {
                    stack.append((child, entry.depth + 1))
                }
            }
        }

        return found.sorted { $0.path < $1.path }
    }

    /// The skip patterns apply only at depth 1: `~/Music` is a media library,
    /// whereas a `Music` folder eight levels down is just a folder someone
    /// named that — quite possibly a project's asset directory.
    private func shouldDescend(into url: URL, atDepth depth: Int) -> Bool {
        let name = url.lastPathComponent
        guard !name.hasPrefix("."), !Self.prunedDirectoryNames.contains(name) else { return false }
        if depth == 1, rootSkipPatterns.contains(where: { Self.name(name, matches: $0) }) {
            return false
        }
        guard !isSymbolicLink(url) else { return false }
        return isDirectory(url)
    }

    private func isDirectory(_ url: URL) -> Bool {
        (try? url.resourceValues(forKeys: [.isDirectoryKey]))?.isDirectory == true
    }

    private func isSymbolicLink(_ url: URL) -> Bool {
        (try? url.resourceValues(forKeys: [.isSymbolicLinkKey]))?.isSymbolicLink == true
    }

    /// `origin`'s URL out of `.git/config`, without shelling out to git.
    ///
    /// The config is INI-shaped and the only section that matters is
    /// `[remote "origin"]`, so this reads exactly that rather than pulling in a
    /// parser for a format git itself treats loosely.
    public static func originRemote(inGitDirectory gitDirectory: URL) -> String? {
        let configURL = gitDirectory.appendingPathComponent("config")
        guard let text = try? String(contentsOf: configURL, encoding: .utf8) else { return nil }
        var inOriginSection = false
        for rawLine in text.split(separator: "\n", omittingEmptySubsequences: false) {
            let line = rawLine.trimmingCharacters(in: .whitespaces)
            if line.hasPrefix("[") {
                inOriginSection = line.replacingOccurrences(of: " ", with: "") == "[remote\"origin\"]"
                continue
            }
            guard inOriginSection, let equals = line.firstIndex(of: "=") else { continue }
            let key = line[line.startIndex..<equals].trimmingCharacters(in: .whitespaces)
            guard key == "url" else { continue }
            let value = line[line.index(after: equals)...].trimmingCharacters(in: .whitespaces)
            return value.isEmpty ? nil : value
        }
        return nil
    }
}
