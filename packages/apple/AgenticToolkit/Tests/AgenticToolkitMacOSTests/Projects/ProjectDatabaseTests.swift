import XCTest
import AgenticToolkitMacOS

/// The project registry's storage contract: a repository is a row, its
/// settings hang off that row, and nothing about it is a file on disk.
@MainActor
final class ProjectDatabaseTests: XCTestCase {

    private var tempRoot: URL!

    override func setUp() async throws {
        try await super.setUp()
        tempRoot = FileManager.default.temporaryDirectory
            .appendingPathComponent("project-db-test-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: tempRoot, withIntermediateDirectories: true)
    }

    override func tearDown() async throws {
        try? FileManager.default.removeItem(at: tempRoot)
        try await super.tearDown()
    }

    // MARK: - Repositories

    func testInsertedRepoRoundTripsEveryColumn() throws {
        let database = try makeDatabase()
        let firstSeen = Date(timeIntervalSince1970: 1_000)
        let repo = GitRepo(
            path: "/Users/someone/Development/whippet",
            name: "whippet",
            remote: "git@github.com:someone/whippet.git",
            firstSeen: firstSeen,
            lastSeen: Date(timeIntervalSince1970: 2_000),
            lastOpened: Date(timeIntervalSince1970: 3_000),
            missingSince: nil
        )
        try database.insert(repo)

        let loaded = try XCTUnwrap(database.repo(id: repo.id))
        XCTAssertEqual(loaded.path, repo.path)
        XCTAssertEqual(loaded.name, "whippet")
        XCTAssertEqual(loaded.remote, "git@github.com:someone/whippet.git")
        XCTAssertEqual(loaded.firstSeen.timeIntervalSince1970, 1_000, accuracy: 0.001)
        XCTAssertEqual(loaded.lastOpened?.timeIntervalSince1970, 3_000)
        XCTAssertFalse(loaded.isMissing)
    }

    /// Both lookups have to agree, because a scan finds a repository by path
    /// and everything else refers to it by id.
    func testARepoIsFoundByPathAsWellAsByID() throws {
        let database = try makeDatabase()
        let repo = GitRepo(path: "/tmp/alpha", name: "alpha")
        try database.insert(repo)

        XCTAssertEqual(try database.repo(path: "/tmp/alpha")?.id, repo.id)
        XCTAssertNil(try database.repo(path: "/tmp/never-scanned"))
    }

    /// The path is the one thing two rows can never share: it is how a scan
    /// recognises a repository it already knows.
    func testTwoRowsCannotShareAPath() throws {
        let database = try makeDatabase()
        try database.insert(GitRepo(path: "/tmp/alpha", name: "alpha"))
        XCTAssertThrowsError(try database.insert(GitRepo(path: "/tmp/alpha", name: "alpha again")))
    }

    func testListingIsSortedByNameCaseInsensitively() throws {
        let database = try makeDatabase()
        try database.insert(GitRepo(path: "/tmp/one", name: "zebra"))
        try database.insert(GitRepo(path: "/tmp/two", name: "Apple"))
        try database.insert(GitRepo(path: "/tmp/three", name: "mango"))

        XCTAssertEqual(try database.allRepos().map(\.name), ["Apple", "mango", "zebra"])
    }

    /// A missing repository stays in the list: the browser decides whether to
    /// show it, the store does not decide for it.
    func testMissingReposAreStillListed() throws {
        let database = try makeDatabase()
        var repo = GitRepo(path: "/Volumes/external/thing", name: "thing")
        try database.insert(repo)
        repo.missingSince = Date(timeIntervalSince1970: 5_000)
        try database.update(repo)

        let loaded = try XCTUnwrap(database.allRepos().first)
        XCTAssertTrue(loaded.isMissing)
        XCTAssertEqual(loaded.missingSince?.timeIntervalSince1970, 5_000)
    }

    func testMarkOpenedRecordsTheTimeWithoutTouchingAnythingElse() throws {
        let database = try makeDatabase()
        let repo = GitRepo(path: "/tmp/alpha", name: "alpha")
        try database.insert(repo)
        XCTAssertNil(try database.repo(id: repo.id)?.lastOpened)

        try database.markOpened(id: repo.id, at: Date(timeIntervalSince1970: 9_000))

        let loaded = try XCTUnwrap(database.repo(id: repo.id))
        XCTAssertEqual(loaded.lastOpened?.timeIntervalSince1970, 9_000)
        XCTAssertEqual(loaded.name, "alpha")
        XCTAssertEqual(loaded.path, "/tmp/alpha")
    }

    /// The user's name for a project is the one fact about it that no scan may
    /// overwrite, so it has to survive a move.
    func testRenamingAndMovingARepoKeepsItsIdentity() throws {
        let database = try makeDatabase()
        var repo = GitRepo(path: "/tmp/alpha", name: "alpha")
        try database.insert(repo)
        repo.name = "The Alpha Project"
        repo.path = "/tmp/moved/alpha"
        try database.update(repo)

        let loaded = try XCTUnwrap(database.repo(id: repo.id))
        XCTAssertEqual(loaded.name, "The Alpha Project")
        XCTAssertEqual(loaded.path, "/tmp/moved/alpha")
        XCTAssertEqual(try database.allRepos().count, 1)
    }

    // MARK: - Settings

    func testSettingsAreScopedToTheirRepo() throws {
        let database = try makeDatabase()
        let alpha = GitRepo(path: "/tmp/alpha", name: "alpha")
        let beta = GitRepo(path: "/tmp/beta", name: "beta")
        try database.insert(alpha)
        try database.insert(beta)

        try database.setSetting(repoID: alpha.id, key: "terminal.shell", value: "/bin/zsh")
        try database.setSetting(repoID: beta.id, key: "terminal.shell", value: "/bin/bash")

        XCTAssertEqual(try database.setting(repoID: alpha.id, key: "terminal.shell"), "/bin/zsh")
        XCTAssertEqual(try database.settings(repoID: beta.id), ["terminal.shell": "/bin/bash"])
    }

    func testWritingASettingTwiceReplacesIt() throws {
        let database = try makeDatabase()
        let repo = GitRepo(path: "/tmp/alpha", name: "alpha")
        try database.insert(repo)

        try database.setSetting(repoID: repo.id, key: "theme", value: "dark")
        try database.setSetting(repoID: repo.id, key: "theme", value: "light")

        XCTAssertEqual(try database.settings(repoID: repo.id), ["theme": "light"])
    }

    /// "Unset" and "set to empty" are different answers, so `nil` removes the
    /// row rather than storing an empty string.
    func testWritingNilRemovesTheSetting() throws {
        let database = try makeDatabase()
        let repo = GitRepo(path: "/tmp/alpha", name: "alpha")
        try database.insert(repo)

        try database.setSetting(repoID: repo.id, key: "theme", value: "")
        XCTAssertEqual(try database.setting(repoID: repo.id, key: "theme"), "")

        try database.setSetting(repoID: repo.id, key: "theme", value: nil)
        XCTAssertNil(try database.setting(repoID: repo.id, key: "theme"))
    }

    /// Deleting a project takes its configuration with it — there is no file to
    /// throw away, so the cascade is the whole cleanup.
    func testDeletingARepoCascadesToItsSettingsAndDirectories() throws {
        let database = try makeDatabase()
        let repo = GitRepo(path: "/tmp/alpha", name: "alpha")
        try database.insert(repo)
        try database.setSetting(repoID: repo.id, key: "theme", value: "dark")
        try database.saveProjectDirectories(["/tmp/notes"], repoID: repo.id)

        try database.delete(id: repo.id)

        XCTAssertNil(try database.repo(id: repo.id))
        XCTAssertTrue(try database.settings(repoID: repo.id).isEmpty)
        XCTAssertEqual(try database.loadProjectDirectories(repoID: repo.id), [])
    }

    // MARK: - Persistence

    /// Reopening the file has to find the same rows, and re-running migrations
    /// against an already-migrated file has to be a no-op (`idempotency`).
    func testReopeningTheSameFileFindsTheSameRows() throws {
        let path = tempRoot.appendingPathComponent("Reopen.db").path
        let repo = GitRepo(path: "/tmp/alpha", name: "alpha")
        do {
            let database = try ProjectDatabase(path: path)
            try database.insert(repo)
            try database.setSetting(repoID: repo.id, key: "theme", value: "dark")
            try database.checkpoint()
        }
        let reopened = try ProjectDatabase(path: path)
        XCTAssertEqual(try reopened.allRepos().map(\.id), [repo.id])
        XCTAssertEqual(try reopened.setting(repoID: repo.id, key: "theme"), "dark")
    }

    /// The database directory is created on demand: `~/.whippet` does not exist
    /// on a machine that has never run the app.
    func testTheDatabaseDirectoryIsCreatedOnDemand() throws {
        let path = tempRoot
            .appendingPathComponent("not-yet-there", isDirectory: true)
            .appendingPathComponent("Whippet.db").path
        _ = try ProjectDatabase(path: path)
        XCTAssertTrue(FileManager.default.fileExists(atPath: path))
    }

    // MARK: - Helpers

    private func makeDatabase() throws -> ProjectDatabase {
        try ProjectDatabase(path: tempRoot.appendingPathComponent("Test.db").path)
    }
}
