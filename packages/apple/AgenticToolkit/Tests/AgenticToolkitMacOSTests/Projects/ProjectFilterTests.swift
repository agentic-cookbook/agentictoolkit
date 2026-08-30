import XCTest
import AgenticToolkitMacOS

/// What the filter matches, and which characters a row is meant to pick out.
final class ProjectFilterTests: XCTestCase {

    func testTheQueryMatchesAnywhereInTheText() {
        let ranges = ProjectFilter.ranges(of: "hip", in: "whippet")

        XCTAssertEqual(ranges, [NSRange(location: 1, length: 3)])
    }

    func testMatchingIgnoresCase() {
        let ranges = ProjectFilter.ranges(of: "WHIP", in: "whippet")

        XCTAssertEqual(ranges, [NSRange(location: 0, length: 4)])
    }

    /// Every occurrence, not just the first: a row that highlighted one of two
    /// identical runs would look like it had picked one for a reason.
    func testEveryOccurrenceIsReturned() {
        let ranges = ProjectFilter.ranges(of: "ab", in: "abcab")

        XCTAssertEqual(ranges, [NSRange(location: 0, length: 2), NSRange(location: 3, length: 2)])
    }

    func testAnEmptyQueryHighlightsNothing() {
        XCTAssertTrue(ProjectFilter.ranges(of: "", in: "whippet").isEmpty)
    }

    func testTextWithoutTheQueryHighlightsNothing() {
        XCTAssertTrue(ProjectFilter.ranges(of: "zz", in: "whippet").isEmpty)
    }

    func testAProjectMatchesOnItsName() {
        XCTAssertTrue(ProjectFilter.matches(repo("/Users/someone/dev/whippet"), query: "hipp"))
    }

    /// Where a project is kept is the other thing someone remembers about it.
    func testAProjectMatchesOnItsPath() {
        XCTAssertTrue(ProjectFilter.matches(repo("/Users/someone/dev/whippet"), query: "someone"))
    }

    func testAProjectMatchingNeitherIsFilteredOut() {
        XCTAssertFalse(ProjectFilter.matches(repo("/Users/someone/dev/whippet"), query: "stenographer"))
    }

    func testAnEmptyQueryMatchesEverything() {
        XCTAssertTrue(ProjectFilter.matches(repo("/Users/someone/dev/whippet"), query: ""))
    }

    private func repo(_ path: String) -> GitRepo {
        GitRepo(path: path, name: GitRepo.defaultName(forPath: path))
    }
}
