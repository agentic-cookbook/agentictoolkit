import XCTest
@testable import AgenticToolkitMacOS

final class GitStatusProviderTests: XCTestCase {
    func testEmptyOutput() {
        let (files, dirs) = GitStatusProvider.parse(porcelain: "")
        XCTAssertTrue(files.isEmpty)
        XCTAssertTrue(dirs.isEmpty)
    }

    func testModifiedFile() {
        let (files, dirs) = GitStatusProvider.parse(porcelain: " M foo.txt")
        XCTAssertEqual(files["foo.txt"], .modified)
        XCTAssertTrue(dirs.isEmpty) // no parent dir
    }

    func testUntrackedFile() {
        let (files, _) = GitStatusProvider.parse(porcelain: "?? untracked/new.txt")
        XCTAssertEqual(files["untracked/new.txt"], .untracked)
    }

    func testDirectoryPropagation() {
        let (_, dirs) = GitStatusProvider.parse(porcelain: " M a/b/c.txt")
        XCTAssertEqual(dirs["a"], .modified)
        XCTAssertEqual(dirs["a/b"], .modified)
    }

    func testRenamedFileUsesNewPath() {
        let (files, _) = GitStatusProvider.parse(porcelain: "R  old.txt -> new.txt")
        XCTAssertEqual(files["new.txt"], .renamed)
        XCTAssertNil(files["old.txt"])
    }
}
