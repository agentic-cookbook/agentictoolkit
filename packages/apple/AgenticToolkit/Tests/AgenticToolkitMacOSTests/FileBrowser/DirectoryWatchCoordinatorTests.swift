import Combine
import XCTest
@testable import AgenticToolkitMacOS

/// A sync must not hand the outline view a different set of objects for the
/// same paths. `FileTreeNode` is equal by path, so a replaced tree is invisible
/// to `NSOutlineView` — it goes on showing a folder as open while the node it
/// asks for children has never been read, and the folder comes back empty.
/// These pin identity across a re-sync.
@MainActor
final class DirectoryWatchCoordinatorTests: XCTestCase {

    /// A throwaway folder with one subdirectory that has a file in it, torn
    /// down with the test.
    private func makeDirectory() -> URL {
        let manager = FileManager.default
        let directory = URL(fileURLWithPath: NSTemporaryDirectory())
            .appendingPathComponent("DirectoryWatchTests-\(UUID().uuidString)")
        try? manager.createDirectory(
            at: directory.appendingPathComponent("nested"),
            withIntermediateDirectories: true
        )
        try? "let x = 1\n".write(
            to: directory.appendingPathComponent("nested/file.swift"),
            atomically: true,
            encoding: .utf8
        )
        addTeardownBlock { try? manager.removeItem(at: directory) }
        return directory
    }

    private func makeCoordinator(at directory: URL) -> DirectoryWatchCoordinator {
        DirectoryWatchCoordinator(rootURL: directory, config: FileTreeConfig(), excludedPrefixes: [])
    }

    /// `fullSync` reads on a background queue, so every assertion waits for the
    /// published root rather than racing it.
    private func sync(_ coordinator: DirectoryWatchCoordinator) {
        let done = expectation(description: "sync complete")
        let token = coordinator.$isSyncing
            .dropFirst()
            .filter { $0 == false }
            .sink { _ in done.fulfill() }
        coordinator.fullSync()
        wait(for: [done], timeout: 5)
        token.cancel()
    }

    /// `loadChildrenIfNeeded` reads on a background queue too, so opening a
    /// folder in a test means waiting for the read to land.
    private func openFolder(_ node: FileTreeNode) {
        let loaded = expectation(description: "children read")
        let token = node.$children
            .dropFirst()
            .sink { _ in loaded.fulfill() }
        node.loadChildrenIfNeeded()
        wait(for: [loaded], timeout: 5)
        token.cancel()
    }

    func testTheFirstSyncPublishesTheRoot() throws {
        let directory = makeDirectory()
        let coordinator = makeCoordinator(at: directory)
        sync(coordinator)

        let root = try XCTUnwrap(coordinator.rootNode)
        XCTAssertEqual(root.url, directory)
        XCTAssertEqual(root.children?.map(\.url.lastPathComponent), ["nested"])
    }

    func testASecondSyncKeepsTheSameNodeObjects() throws {
        let directory = makeDirectory()
        let coordinator = makeCoordinator(at: directory)
        sync(coordinator)
        let root = try XCTUnwrap(coordinator.rootNode)
        let nested = try XCTUnwrap(root.children?.first)

        sync(coordinator)

        XCTAssertTrue(coordinator.rootNode === root, "the root the outline holds must survive a re-sync")
        XCTAssertTrue(
            coordinator.rootNode?.children?.first === nested,
            "a replaced child is a node the outline is not showing, however equal it compares"
        )
    }

    /// The bug this fixes: a folder the user had opened came back empty,
    /// because the read that filled it belonged to an orphaned object.
    func testASecondSyncKeepsChildrenThatWereAlreadyRead() throws {
        let directory = makeDirectory()
        let coordinator = makeCoordinator(at: directory)
        sync(coordinator)
        let nested = try XCTUnwrap(coordinator.rootNode?.children?.first)
        openFolder(nested)
        XCTAssertEqual(nested.children?.map(\.url.lastPathComponent), ["file.swift"])

        sync(coordinator)

        XCTAssertEqual(
            coordinator.rootNode?.children?.first?.children?.map(\.url.lastPathComponent),
            ["file.swift"]
        )
    }

    func testASyncOfADifferentRootReplacesTheTree() {
        let directory = makeDirectory()
        let coordinator = makeCoordinator(at: directory)
        coordinator.rootNode = FileTreeNode(url: directory.appendingPathComponent("elsewhere"), isDirectory: true)

        sync(coordinator)

        XCTAssertEqual(coordinator.rootNode?.url, directory)
    }
}
