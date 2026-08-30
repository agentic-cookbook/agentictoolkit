import XCTest
import AgenticToolkitMacOS

/// What counts as a project on disk. The rules are shared with `proj projects`,
/// so the two tools agree about what the user's projects are.
final class GitRepoScannerTests: XCTestCase {

    private var root: URL!

    override func setUp() async throws {
        try await super.setUp()
        root = FileManager.default.temporaryDirectory
            .appendingPathComponent("scanner-test-\(UUID().uuidString)")
            .standardizedFileURL
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    }

    override func tearDown() async throws {
        try? FileManager.default.removeItem(at: root)
        try await super.tearDown()
    }

    func testAPlainRepositoryIsFoundWithItsOriginRemote() throws {
        try makeRepo("dev/alpha", remote: "git@example.com:someone/alpha.git")

        let found = GitRepoScanner(roots: [root]).scan()

        XCTAssertEqual(paths(found), [path("dev/alpha")])
        XCTAssertEqual(found.first?.remote, "git@example.com:someone/alpha.git")
        XCTAssertEqual(found.first?.leafName, "alpha")
    }

    /// A repository is a leaf: the walk stops there. That is also what keeps
    /// submodules and nested checkouts out of the list — they live inside a
    /// repository.
    func testARepositoryInsideARepositoryIsNotAProject() throws {
        try makeRepo("dev/alpha")
        try makeRepo("dev/alpha/external/toolkit")

        XCTAssertEqual(paths(GitRepoScanner(roots: [root]).scan()), [path("dev/alpha")])
    }

    /// An absorbed submodule or a linked worktree has a `.git` *file* rather
    /// than a directory. Neither is a project in its own right.
    func testADirectoryWhoseGitIsAFileIsSkippedEntirely() throws {
        let worktree = root.appendingPathComponent("dev/worktree", isDirectory: true)
        try FileManager.default.createDirectory(at: worktree, withIntermediateDirectories: true)
        try "gitdir: /somewhere/else/.git/worktrees/x\n"
            .write(to: worktree.appendingPathComponent(".git"), atomically: true, encoding: .utf8)
        try makeRepo("dev/alpha")

        XCTAssertEqual(paths(GitRepoScanner(roots: [root]).scan()), [path("dev/alpha")])
    }

    func testHiddenDirectoriesAreNeverDescendedInto() throws {
        try makeRepo(".claude/worktrees/feature")
        try makeRepo("dev/alpha")

        XCTAssertEqual(paths(GitRepoScanner(roots: [root]).scan()), [path("dev/alpha")])
    }

    /// `~/Library` is full of vendored checkouts belonging to other tools.
    func testLibraryDirectlyUnderARootIsSkipped() throws {
        try makeRepo("Library/Caches/somebody-elses-checkout")
        try makeRepo("dev/alpha")

        XCTAssertEqual(paths(GitRepoScanner(roots: [root]).scan()), [path("dev/alpha")])
    }

    /// Only *directly* under a root: a `Library` folder further down is just a
    /// folder someone named that.
    func testALibraryFolderFurtherDownIsStillScanned() throws {
        try makeRepo("dev/Library/gamma")

        XCTAssertEqual(paths(GitRepoScanner(roots: [root]).scan()), [path("dev/Library/gamma")])
    }

    func testBuildAndDependencyDirectoriesArePruned() throws {
        for pruned in GitRepoScanner.prunedDirectoryNames {
            try makeRepo("dev/\(pruned)/vendored")
        }
        try makeRepo("dev/alpha")

        XCTAssertEqual(paths(GitRepoScanner(roots: [root]).scan()), [path("dev/alpha")])
    }

    /// Following symlinks turns one repository into several, or into a loop.
    func testSymlinkedDirectoriesAreNotFollowed() throws {
        try makeRepo("dev/alpha")
        try FileManager.default.createSymbolicLink(
            at: root.appendingPathComponent("mirror"),
            withDestinationURL: root.appendingPathComponent("dev")
        )

        XCTAssertEqual(paths(GitRepoScanner(roots: [root]).scan()), [path("dev/alpha")])
    }

    /// Sorted output, so two scans of an unchanged tree are byte-identical
    /// and the reconciler sees no churn (`idempotency`).
    func testResultsAreSortedByPathAndStableAcrossRuns() throws {
        try makeRepo("dev/zeta")
        try makeRepo("dev/alpha")
        try makeRepo("work/beta")

        let scanner = GitRepoScanner(roots: [root])
        let first = scanner.scan()
        XCTAssertEqual(paths(first), [path("dev/alpha"), path("dev/zeta"), path("work/beta")])
        XCTAssertEqual(first, scanner.scan())
    }

    func testAnEmptyTreeFindsNothingRatherThanFailing() {
        XCTAssertTrue(GitRepoScanner(roots: [root]).scan().isEmpty)
    }

    func testProgressIsReportedAsTheWalkGoes() throws {
        try makeRepo("dev/alpha")
        let reports = Recorder()

        _ = GitRepoScanner(roots: [root]).scan(onProgress: { progress in
            reports.append(progress)
        })

        XCTAssertGreaterThan(reports.count, 0, "the progress window needs something truthful to say")
        XCTAssertEqual(reports.lastVisited, reports.count,
                       "every visited directory is reported exactly once")
    }

    /// The hook exists because the alternative is a walk that keeps running
    /// after the app is told to quit.
    func testCancellationStopsTheWalk() throws {
        try makeRepo("dev/alpha")
        try makeRepo("work/beta")

        let found = GitRepoScanner(roots: [root]).scan(isCancelled: { true })

        XCTAssertTrue(found.isEmpty)
    }

    // MARK: - Remote parsing

    func testOriginIsReadOutOfTheConfigWithoutShellingOutToGit() throws {
        let gitDirectory = try makeRepo("dev/alpha", configBody: """
            [core]
            \trepositoryformatversion = 0
            [remote "upstream"]
            \turl = git@example.com:upstream/alpha.git
            [remote "origin"]
            \turl = git@example.com:someone/alpha.git
            \tfetch = +refs/heads/*:refs/remotes/origin/*
            [branch "main"]
            \tremote = origin
            """)

        XCTAssertEqual(GitRepoScanner.originRemote(inGitDirectory: gitDirectory),
                       "git@example.com:someone/alpha.git")
    }

    func testARepositoryWithNoOriginHasNoRemote() throws {
        let gitDirectory = try makeRepo("dev/alpha", configBody: "[core]\n\tbare = false\n")
        XCTAssertNil(GitRepoScanner.originRemote(inGitDirectory: gitDirectory))
    }

    func testAMissingConfigIsNotAnError() throws {
        let gitDirectory = root.appendingPathComponent("dev/alpha/.git", isDirectory: true)
        try FileManager.default.createDirectory(at: gitDirectory, withIntermediateDirectories: true)
        XCTAssertNil(GitRepoScanner.originRemote(inGitDirectory: gitDirectory))
    }

    // MARK: - Helpers

    /// Records progress from whatever thread the walk runs on.
    private final class Recorder: @unchecked Sendable {
        private let lock = NSLock()
        private var visited: [Int] = []

        func append(_ progress: GitRepoScanner.Progress) {
            lock.lock()
            visited.append(progress.directoriesVisited)
            lock.unlock()
        }

        var count: Int {
            lock.lock(); defer { lock.unlock() }
            return visited.count
        }

        var lastVisited: Int {
            lock.lock(); defer { lock.unlock() }
            return visited.last ?? 0
        }
    }

    @discardableResult
    private func makeRepo(_ relativePath: String, remote: String? = nil) throws -> URL {
        let body = remote.map { "[remote \"origin\"]\n\turl = \($0)\n" } ?? "[core]\n\tbare = false\n"
        return try makeRepo(relativePath, configBody: body)
    }

    @discardableResult
    private func makeRepo(_ relativePath: String, configBody: String) throws -> URL {
        let gitDirectory = root
            .appendingPathComponent(relativePath, isDirectory: true)
            .appendingPathComponent(".git", isDirectory: true)
        try FileManager.default.createDirectory(at: gitDirectory, withIntermediateDirectories: true)
        try configBody.write(to: gitDirectory.appendingPathComponent("config"),
                             atomically: true, encoding: .utf8)
        return gitDirectory
    }

    private func path(_ relativePath: String) -> String {
        root.appendingPathComponent(relativePath, isDirectory: true).standardizedFileURL.path
    }

    private func paths(_ found: [ScannedGitRepo]) -> [String] {
        found.map { URL(fileURLWithPath: $0.path).standardizedFileURL.path }
    }
}
