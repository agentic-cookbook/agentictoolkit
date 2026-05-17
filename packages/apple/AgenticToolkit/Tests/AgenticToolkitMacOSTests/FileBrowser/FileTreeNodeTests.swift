import XCTest
@testable import AgenticToolkitMacOS

final class FileTreeNodeTests: XCTestCase {
    func testNoPackageExtensions() {
        let url = URL(fileURLWithPath: "/tmp/some.catnip-proj")
        let node = FileTreeNode(url: url, isDirectory: true, loadChildren: false, packageExtensions: [])
        XCTAssertFalse(node.isPackage)
    }

    func testMatchingPackageExtension() {
        let url = URL(fileURLWithPath: "/tmp/some.catnip-proj")
        let node = FileTreeNode(url: url, isDirectory: true, loadChildren: false, packageExtensions: ["catnip-proj"])
        XCTAssertTrue(node.isPackage)
    }

    func testNonMatchingPackageExtension() {
        let url = URL(fileURLWithPath: "/tmp/some.txt")
        let node = FileTreeNode(url: url, isDirectory: false, loadChildren: false, packageExtensions: ["catnip-proj"])
        XCTAssertFalse(node.isPackage)
    }
}
