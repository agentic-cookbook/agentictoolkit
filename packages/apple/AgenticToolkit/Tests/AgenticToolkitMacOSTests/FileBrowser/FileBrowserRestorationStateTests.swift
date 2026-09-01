import XCTest
import AgenticToolkitMacOS

/// What the browser looked like, and the reporting contract a host persists
/// through.
@MainActor
final class FileBrowserRestorationStateTests: XCTestCase {

    func testItStartsAsWhatWasStored() {
        let state = FileBrowserRestorationState(
            expandedPaths: ["/tmp/a", "/tmp/a/b"], selectedPath: "/tmp/a/b/c.swift")
        XCTAssertTrue(state.isExpanded("/tmp/a"))
        XCTAssertTrue(state.isExpanded("/tmp/a/b"))
        XCTAssertFalse(state.isExpanded("/tmp/other"))
        XCTAssertEqual(state.selectedPath, "/tmp/a/b/c.swift")
    }

    func testEveryChangeIsReportedWithBothHalves() {
        let state = FileBrowserRestorationState()
        var reports: [(paths: [String], selected: String?)] = []
        state.onChange = { reports.append((paths: $0, selected: $1)) }

        state.setExpanded(true, path: "/tmp/b")
        state.setExpanded(true, path: "/tmp/a")
        state.setSelectedPath("/tmp/a/x.swift")
        state.setExpanded(false, path: "/tmp/b")

        XCTAssertEqual(reports.map(\.paths),
                       [["/tmp/b"], ["/tmp/a", "/tmp/b"], ["/tmp/a", "/tmp/b"], ["/tmp/a"]],
                       "paths are reported sorted, so an unchanged arrangement serializes identically")
        XCTAssertEqual(reports.map(\.selected), [nil, nil, "/tmp/a/x.swift", "/tmp/a/x.swift"])
    }

    /// A tree redrawing itself re-reports what it already had; writing on those
    /// would put the database in the middle of every git-status refresh
    /// (`idempotency`).
    func testAChangeThatChangesNothingIsNotReported() {
        let state = FileBrowserRestorationState(expandedPaths: ["/tmp/a"], selectedPath: "/tmp/a/x")
        var reportCount = 0
        state.onChange = { _, _ in reportCount += 1 }

        state.setExpanded(true, path: "/tmp/a")
        state.setSelectedPath("/tmp/a/x")
        state.setExpanded(false, path: "/tmp/never-was-open")
        XCTAssertEqual(reportCount, 0)

        state.setSelectedPath(nil)
        XCTAssertEqual(reportCount, 1, "losing the selection is a change like any other")
    }
}
