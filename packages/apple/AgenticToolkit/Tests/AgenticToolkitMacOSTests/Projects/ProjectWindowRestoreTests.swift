import XCTest
@testable import AgenticToolkitMacOS

/// Reopening the windows that were up at quit has to survive the folder under
/// one of them being deleted or renamed in the meantime — otherwise the
/// workspace comes back with an empty tree and a terminal in `/`, which reads
/// as a broken app rather than a missing project.
@MainActor
final class ProjectWindowRestoreTests: XCTestCase {

    private func makeRepo(_ name: String, path: String) -> GitRepo {
        GitRepo(path: path, name: name, remote: nil, firstSeen: Date(), lastSeen: Date())
    }

    func testAProjectThatWasOpenAndIsStillOnDiskIsReopened() {
        let here = makeRepo("here", path: "/here")

        let plan = ProjectWindowManager.restorePlan(
            repos: [here],
            wasOpen: { _ in true },
            existsOnDisk: { _ in true }
        )

        XCTAssertEqual(plan.reopen.map(\.name), ["here"])
        XCTAssertTrue(plan.forget.isEmpty)
    }

    func testAProjectThatWasNotOpenIsLeftAlone() {
        let closed = makeRepo("closed", path: "/closed")

        let plan = ProjectWindowManager.restorePlan(
            repos: [closed],
            wasOpen: { _ in false },
            existsOnDisk: { _ in true }
        )

        XCTAssertTrue(plan.reopen.isEmpty)
        XCTAssertTrue(plan.forget.isEmpty, "a project nobody had open has no flag to clear")
    }

    /// The regression: a renamed folder reopened as an empty workspace.
    func testAProjectWhoseFolderIsGoneIsForgottenRatherThanReopened() {
        let gone = makeRepo("gone", path: "/gone")

        let plan = ProjectWindowManager.restorePlan(
            repos: [gone],
            wasOpen: { _ in true },
            existsOnDisk: { _ in false }
        )

        XCTAssertTrue(plan.reopen.isEmpty)
        XCTAssertEqual(plan.forget.map(\.name), ["gone"], "the flag has to be cleared, or it retries every launch")
    }

    func testOneMissingProjectDoesNotStopTheOthersReopening() {
        let gone = makeRepo("gone", path: "/gone")
        let here = makeRepo("here", path: "/here")

        let plan = ProjectWindowManager.restorePlan(
            repos: [gone, here],
            wasOpen: { _ in true },
            existsOnDisk: { $0.path == "/here" }
        )

        XCTAssertEqual(plan.reopen.map(\.name), ["here"])
        XCTAssertEqual(plan.forget.map(\.name), ["gone"])
    }
}
