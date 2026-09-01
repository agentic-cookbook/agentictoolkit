import XCTest
import AgenticToolkitMacOS

/// The interesting half of a scan: did this repository move, or is it a
/// different one? Pure input to pure output — no database, no filesystem.
final class ProjectReconcilerTests: XCTestCase {

    private let now = Date(timeIntervalSince1970: 100_000)

    // MARK: - New repositories

    func testAnUnknownPathBecomesAnInsert() throws {
        let plan = ProjectReconciler.plan(
            existing: [],
            scanned: [scan("/Users/someone/dev/whippet", remote: "git@example.com:someone/whippet.git")],
            now: now
        )
        XCTAssertEqual(plan.updates.count, 0)
        let inserted = try XCTUnwrap(plan.inserts.first)
        XCTAssertEqual(inserted.path, "/Users/someone/dev/whippet")
        XCTAssertEqual(inserted.name, "whippet")
        XCTAssertEqual(inserted.remote, "git@example.com:someone/whippet.git")
        XCTAssertEqual(inserted.firstSeen, now)
        XCTAssertEqual(inserted.lastSeen, now)
        XCTAssertEqual(plan.summary.added, 1)
    }

    /// Two checkouts of the same directory name are told apart by adding parent
    /// segments — the rule `proj projects` uses, so a project has the same name
    /// in both tools.
    func testASecondRepoWithTheSameLeafNameIsQualifiedByItsParent() throws {
        let existing = [repo(path: "/Users/someone/work/api", name: "api")]
        let plan = ProjectReconciler.plan(
            existing: existing,
            scanned: [scan("/Users/someone/work/api"), scan("/Users/someone/oss/api")],
            now: now
        )
        XCTAssertEqual(plan.inserts.map(\.name), ["oss/api"])
        XCTAssertEqual(plan.summary.added, 1)
        XCTAssertEqual(plan.summary.unchanged, 1)
    }

    func testUniqueNameWalksUpUntilItIsFree() {
        XCTAssertEqual(ProjectReconciler.uniqueName(forPath: "/a/b/c", taken: []), "c")
        XCTAssertEqual(ProjectReconciler.uniqueName(forPath: "/a/b/c", taken: ["c"]), "b/c")
        XCTAssertEqual(ProjectReconciler.uniqueName(forPath: "/a/b/c", taken: ["c", "b/c"]), "a/b/c")
    }

    // MARK: - Unchanged and updated

    /// A repository found exactly where it was is not a write: re-running a
    /// scan over an unchanged tree has to leave the database alone
    /// (`idempotency`).
    func testAnUnchangedRepoProducesNoWrite() {
        let existing = [repo(path: "/tmp/alpha", name: "alpha", remote: "origin-url")]
        let plan = ProjectReconciler.plan(
            existing: existing,
            scanned: [scan("/tmp/alpha", remote: "origin-url")],
            now: now
        )
        XCTAssertTrue(plan.inserts.isEmpty)
        XCTAssertTrue(plan.updates.isEmpty)
        XCTAssertEqual(plan.summary.unchanged, 1)
    }

    func testARepointedRemoteIsWrittenBack() throws {
        let existing = [repo(path: "/tmp/alpha", name: "alpha", remote: "old-url")]
        let plan = ProjectReconciler.plan(
            existing: existing,
            scanned: [scan("/tmp/alpha", remote: "new-url")],
            now: now
        )
        let updated = try XCTUnwrap(plan.updates.first)
        XCTAssertEqual(updated.remote, "new-url")
        XCTAssertEqual(updated.name, "alpha", "a scan never renames a project")
        XCTAssertEqual(plan.summary.unchanged, 1)
    }

    // MARK: - Moves

    func testAMovedRepoIsMatchedByItsRemote() throws {
        let existing = [repo(path: "/Users/someone/old/alpha", name: "My Alpha", remote: "git@example.com:a.git")]
        let plan = ProjectReconciler.plan(
            existing: existing,
            scanned: [scan("/Users/someone/new/renamed-folder", remote: "git@example.com:a.git")],
            now: now
        )
        XCTAssertTrue(plan.inserts.isEmpty, "a move must not also look like a new project")
        let moved = try XCTUnwrap(plan.updates.first)
        XCTAssertEqual(moved.id, existing[0].id)
        XCTAssertEqual(moved.path, "/Users/someone/new/renamed-folder")
        XCTAssertEqual(moved.name, "My Alpha", "the user's name for a project survives a move")
        XCTAssertEqual(plan.summary.moved, 1)
        XCTAssertTrue(plan.deletes.isEmpty)
    }

    /// A repository with no remote — never pushed anywhere — can still be
    /// followed, by its directory name.
    func testARepoWithNoRemoteIsMatchedByItsDirectoryName() throws {
        let existing = [repo(path: "/Users/someone/old/alpha", name: "My Alpha")]
        let plan = ProjectReconciler.plan(
            existing: existing,
            scanned: [scan("/Users/someone/new/alpha")],
            now: now
        )
        let moved = try XCTUnwrap(plan.updates.first)
        XCTAssertEqual(moved.path, "/Users/someone/new/alpha")
        XCTAssertEqual(plan.summary.moved, 1)
        XCTAssertTrue(plan.inserts.isEmpty)
    }

    /// Two candidates means the answer is a guess, and a guess here silently
    /// re-points a project's settings at the wrong folder.
    func testAnAmbiguousMoveDeletesTheRow() throws {
        let existing = [repo(path: "/Users/someone/old/alpha", name: "My Alpha", remote: "git@example.com:a.git")]
        let plan = ProjectReconciler.plan(
            existing: existing,
            scanned: [
                scan("/Users/someone/one/copy", remote: "git@example.com:a.git"),
                scan("/Users/someone/two/copy", remote: "git@example.com:a.git")
            ],
            now: now
        )
        XCTAssertEqual(plan.summary.moved, 0)
        XCTAssertEqual(plan.summary.removed, 1)
        XCTAssertEqual(plan.inserts.count, 2, "both copies are new projects in their own right")
        XCTAssertEqual(plan.deletes.map(\.id), [existing[0].id])
    }

    /// A move has to claim its new path before the adoption pass turns that
    /// same path into a second, brand-new project.
    func testAMoveIsResolvedBeforeTheNewPathIsAdopted() {
        let existing = [repo(path: "/tmp/old/alpha", name: "alpha", remote: "git@example.com:a.git")]
        let plan = ProjectReconciler.plan(
            existing: existing,
            scanned: [scan("/tmp/new/alpha", remote: "git@example.com:a.git")],
            now: now
        )
        XCTAssertTrue(plan.inserts.isEmpty)
        XCTAssertEqual(plan.updates.count, 1)
    }

    // MARK: - Removal

    /// The registry is a picture of what is on disk now. A row nothing on disk
    /// accounts for is deleted, settings and all, rather than kept as a project
    /// that cannot be opened.
    func testAVanishedRepoIsDeleted() {
        let existing = [repo(path: "/tmp/alpha", name: "alpha", remote: "git@example.com:a.git")]
        let plan = ProjectReconciler.plan(existing: existing, scanned: [], now: now)

        XCTAssertTrue(plan.inserts.isEmpty)
        XCTAssertTrue(plan.updates.isEmpty)
        XCTAssertEqual(plan.deletes.map(\.id), [existing[0].id])
        XCTAssertEqual(plan.summary.removed, 1)
    }

    // MARK: - Summary

    func testTheSummaryCountsEveryRepoExactlyOnce() {
        let existing = [
            repo(path: "/tmp/stays", name: "stays"),
            repo(path: "/tmp/old/moves", name: "moves", remote: "git@example.com:m.git"),
            repo(path: "/tmp/gone", name: "gone")
        ]
        let plan = ProjectReconciler.plan(
            existing: existing,
            scanned: [
                scan("/tmp/stays"),
                scan("/tmp/new/moves", remote: "git@example.com:m.git"),
                scan("/tmp/brand-new")
            ],
            now: now
        )
        XCTAssertEqual(plan.summary.unchanged, 1)
        XCTAssertEqual(plan.summary.moved, 1)
        XCTAssertEqual(plan.summary.removed, 1)
        XCTAssertEqual(plan.summary.added, 1)
        // Three of the four are on disk, and the fourth is deleted rather than
        // counted — the registry afterwards holds exactly those three.
        XCTAssertEqual(plan.summary.found, 3)
        XCTAssertEqual(plan.summary.summaryText, "3 projects — 1 new, 1 moved, 1 removed")
    }

    func testAQuietScanSaysSo() {
        let plan = ProjectReconciler.plan(
            existing: [repo(path: "/tmp/alpha", name: "alpha")],
            scanned: [scan("/tmp/alpha")],
            now: now
        )
        XCTAssertEqual(plan.summary.summaryText, "1 project, no changes")
    }

    // MARK: - Helpers

    private func repo(path: String, name: String, remote: String? = nil) -> GitRepo {
        GitRepo(path: path, name: name, remote: remote)
    }

    private func scan(_ path: String, remote: String? = nil) -> ScannedGitRepo {
        ScannedGitRepo(path: path, remote: remote)
    }
}
