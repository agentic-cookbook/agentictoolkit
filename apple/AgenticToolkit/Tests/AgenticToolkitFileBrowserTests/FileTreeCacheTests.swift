import XCTest
@testable import AgenticToolkitFileBrowser

final class FileTreeCacheTests: XCTestCase {
    func testRoundtrip() throws {
        let tmp = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: tmp, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: tmp) }

        let entries: [FileTreeCacheEntry] = [
            FileTreeCacheEntry(
                path: "/tmp/foo",
                parentPath: nil,
                name: "foo",
                isDirectory: true,
                isPackage: false,
                fileSize: nil,
                modificationDate: nil
            ),
            FileTreeCacheEntry(
                path: "/tmp/foo/a.txt",
                parentPath: "/tmp/foo",
                name: "a.txt",
                isDirectory: false,
                isPackage: false,
                fileSize: 42,
                modificationDate: Date(timeIntervalSince1970: 0)
            )
        ]

        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        let data = try encoder.encode(entries)
        try data.write(to: tmp.appendingPathComponent(FileTreeCache.cacheFilename), options: .atomic)

        let root = FileTreeCache.load(from: tmp)
        XCTAssertNotNil(root)
        XCTAssertEqual(root?.name, "foo")
        XCTAssertEqual(root?.children?.count, 1)
        XCTAssertEqual(root?.children?.first?.name, "a.txt")
        XCTAssertEqual(root?.children?.first?.fileSize, 42)
    }
}
