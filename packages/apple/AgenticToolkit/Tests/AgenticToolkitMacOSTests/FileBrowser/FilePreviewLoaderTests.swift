import Foundation
import Testing
@testable import AgenticToolkitMacOS

/// Clicking a file has to show the file. These pin which of the two renderers
/// each kind of file reaches — the source editor for text, QuickLook for
/// everything else — because the failure they guard against is silent: a PNG
/// that reports "cannot display" looks like a rendering bug, not a routing one.
@Suite("FilePreviewLoader")
struct FilePreviewLoaderTests {

    private func makeDirectory() throws -> URL {
        let directory = URL(fileURLWithPath: NSTemporaryDirectory())
            .appendingPathComponent("FilePreviewLoaderTests-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        return directory
    }

    @Test("a UTF-8 file loads as editable text")
    func text() async throws {
        let directory = try makeDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }

        let url = directory.appendingPathComponent("hello.swift")
        try "let x = 1\n".write(to: url, atomically: true, encoding: .utf8)

        #expect(await FilePreviewLoader.read(url) == .text("let x = 1\n"))
    }

    @Test("an empty file is still text, not a failure")
    func empty() async throws {
        let directory = try makeDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }

        let url = directory.appendingPathComponent("empty.txt")
        try Data().write(to: url)

        #expect(await FilePreviewLoader.read(url) == .text(""))
    }

    @Test("a binary file goes to QuickLook rather than reporting a failure")
    func binary() async throws {
        let directory = try makeDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }

        // A one-pixel PNG: real magic bytes, and invalid UTF-8.
        let url = directory.appendingPathComponent("pixel.png")
        try Data([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0xFF, 0xFE, 0xC0]).write(to: url)

        #expect(await FilePreviewLoader.read(url) == .quickLook)
    }

    /// The cap exists because the editor holds the whole string in memory.
    /// QuickLook does not, so an oversized text file is shown rather than
    /// refused.
    @Test("a text file past the size cap goes to QuickLook instead of the editor")
    func oversizedText() async throws {
        let directory = try makeDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }

        let url = directory.appendingPathComponent("huge.log")
        let line = Data(repeating: UInt8(ascii: "a"), count: 1024 * 1024)
        FileManager.default.createFile(atPath: url.path, contents: nil)
        let handle = try FileHandle(forWritingTo: url)
        defer { try? handle.close() }
        for _ in 0...(FilePreviewLoader.maximumTextSize / line.count) {
            try handle.write(contentsOf: line)
        }
        try handle.synchronize()

        #expect(await FilePreviewLoader.read(url) == .quickLook)
    }

    @Test("a file that isn't there is unavailable")
    func missing() async throws {
        let directory = try makeDirectory()
        defer { try? FileManager.default.removeItem(at: directory) }

        let url = directory.appendingPathComponent("nothing-here.txt")

        #expect(await FilePreviewLoader.read(url) == .unavailable)
    }
}
