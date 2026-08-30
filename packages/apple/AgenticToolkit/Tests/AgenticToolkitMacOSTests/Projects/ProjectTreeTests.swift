import XCTest
import AgenticToolkitMacOS

/// The shape the project chooser draws: folders that lead to projects, and the
/// projects themselves.
@MainActor
final class ProjectTreeTests: XCTestCase {

    private let home = URL(fileURLWithPath: "/Users/someone")

    func testProjectsAppearUnderTheFoldersThatHoldThem() {
        let roots = ProjectTree.build(
            from: [repo("/Users/someone/Development/projects/whippet"),
                   repo("/Users/someone/Development/projects/adh")],
            homeDirectory: home
        )

        XCTAssertEqual(roots.map(\.name), ["Development"])
        XCTAssertEqual(roots[0].children.map(\.name), ["projects"])
        XCTAssertEqual(roots[0].children[0].children.map(\.name), ["adh", "whippet"])
    }

    /// The home directory is the same prefix for everything, so it is not a
    /// row: the top of the list is the first folder that tells them apart.
    func testTheHomeDirectoryIsNotShownAsFolders() {
        let roots = ProjectTree.build(from: [repo("/Users/someone/dev/alpha")], homeDirectory: home)

        XCTAssertEqual(roots.map(\.name), ["dev"])
    }

    /// A path outside home keeps its leading slash — that is the only thing
    /// telling `/opt` apart from a folder of the user's called `opt`.
    func testAPathOutsideHomeKeepsItsLeadingSlash() {
        let roots = ProjectTree.build(from: [repo("/opt/checkouts/alpha")], homeDirectory: home)

        XCTAssertEqual(roots.map(\.name), ["/opt"])
        XCTAssertEqual(roots[0].children.map(\.name), ["checkouts"])
    }

    /// The file browser's order, because this is meant to read as the same kind
    /// of list.
    func testFoldersSortBeforeProjectsAndBothSortAlphabetically() {
        let roots = ProjectTree.build(
            from: [repo("/Users/someone/dev/zeta"),
                   repo("/Users/someone/dev/alpha"),
                   repo("/Users/someone/dev/nested/beta")],
            homeDirectory: home
        )

        XCTAssertEqual(roots[0].children.map(\.name), ["nested", "alpha", "zeta"])
    }

    /// A project's row is named for the project, not for its directory: the
    /// registry is what says what a project is called.
    func testAProjectRowTakesItsNameFromTheRegistry() {
        let roots = ProjectTree.build(
            from: [repo("/Users/someone/dev/alpha", name: "Alpha (main)")],
            homeDirectory: home
        )

        XCTAssertEqual(roots[0].children.map(\.name), ["Alpha (main)"])
    }

    func testTwoTreesWithSameNamedFoldersDoNotCollapseIntoOne() {
        let roots = ProjectTree.build(
            from: [repo("/Users/someone/work/src/alpha"),
                   repo("/Users/someone/play/src/beta")],
            homeDirectory: home
        )

        XCTAssertEqual(roots.map(\.name), ["play", "work"])
        XCTAssertEqual(roots[0].children[0].children.map(\.name), ["beta"])
        XCTAssertEqual(roots[1].children[0].children.map(\.name), ["alpha"])
    }

    /// What the chooser uses to put the selection on something it can open.
    func testTheProjectsAreReadableInDisplayOrder() {
        let roots = ProjectTree.build(
            from: [repo("/Users/someone/dev/zeta"),
                   repo("/Users/someone/dev/nested/beta"),
                   repo("/Users/someone/dev/alpha")],
            homeDirectory: home
        )

        XCTAssertEqual(roots.flatMap { $0.repositoriesInDisplayOrder }.map(\.name),
                       ["beta", "alpha", "zeta"])
    }

    func testAnEmptyRegistryBuildsAnEmptyTree() {
        XCTAssertTrue(ProjectTree.build(from: [], homeDirectory: home).isEmpty)
    }

    private func repo(_ path: String, name: String? = nil) -> GitRepo {
        GitRepo(path: path, name: name ?? GitRepo.defaultName(forPath: path))
    }
}
