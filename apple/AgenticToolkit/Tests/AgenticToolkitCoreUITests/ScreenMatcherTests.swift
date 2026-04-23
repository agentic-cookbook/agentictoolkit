import XCTest
@testable import AgenticToolkitCoreUI

final class ScreenMatcherTests: XCTestCase {

    func testExactMatchByUUIDAndResolution() {
        let fingerprint = ScreenFingerprint(
            displayUUID: "ABC-123",
            localizedName: "Built-in Display",
            resolutionWidth: 1920,
            resolutionHeight: 1080,
            isMain: true
        )
        let screen = MockScreen(
            frame: NSRect(x: 0, y: 0, width: 1920, height: 1080),
            uuid: "ABC-123", name: "Built-in Display", isMain: true
        )

        let match = ScreenMatcher.findBestMatch(for: fingerprint, among: [screen])
        XCTAssertEqual(match?.quality, .exact)
    }

    func testUUIDMatchWithResolutionChange() {
        let fingerprint = ScreenFingerprint(
            displayUUID: "ABC-123",
            localizedName: "Built-in Display",
            resolutionWidth: 1920,
            resolutionHeight: 1080,
            isMain: true
        )
        let screen = MockScreen(
            frame: NSRect(x: 0, y: 0, width: 2560, height: 1440),
            uuid: "ABC-123", name: "Built-in Display", isMain: true
        )

        let match = ScreenMatcher.findBestMatch(for: fingerprint, among: [screen])
        XCTAssertEqual(match?.quality, .uuidResChanged)
    }

    func testNameMatchWhenUUIDDiffers() {
        let fingerprint = ScreenFingerprint(
            displayUUID: "OLD-UUID",
            localizedName: "LG UltraFine",
            resolutionWidth: 3840,
            resolutionHeight: 2160,
            isMain: false
        )
        let screen = MockScreen(
            frame: NSRect(x: 0, y: 0, width: 3840, height: 2160),
            uuid: "NEW-UUID", name: "LG UltraFine", isMain: false
        )

        let match = ScreenMatcher.findBestMatch(for: fingerprint, among: [screen])
        XCTAssertEqual(match?.quality, .nameOnly)
    }

    func testPositionMatchMainScreen() {
        let fingerprint = ScreenFingerprint(
            displayUUID: "GONE-UUID",
            localizedName: "Disconnected Monitor",
            resolutionWidth: 2560,
            resolutionHeight: 1440,
            isMain: true
        )
        let screen = MockScreen(
            frame: NSRect(x: 0, y: 0, width: 1920, height: 1080),
            uuid: "DIFFERENT", name: "Built-in Display", isMain: true
        )

        let match = ScreenMatcher.findBestMatch(for: fingerprint, among: [screen])
        XCTAssertEqual(match?.quality, .positionOnly)
    }

    func testNoMatchReturnsNil() {
        let fingerprint = ScreenFingerprint(
            displayUUID: "GONE-UUID",
            localizedName: "Disconnected Monitor",
            resolutionWidth: 2560,
            resolutionHeight: 1440,
            isMain: false
        )
        let screen = MockScreen(
            frame: NSRect(x: 0, y: 0, width: 1920, height: 1080),
            uuid: "DIFFERENT", name: "Built-in Display", isMain: false
        )

        let match = ScreenMatcher.findBestMatch(for: fingerprint, among: [screen])
        XCTAssertNil(match)
    }

    func testBestMatchSelectedFromMultipleScreens() {
        let fingerprint = ScreenFingerprint(
            displayUUID: "TARGET-UUID",
            localizedName: "External",
            resolutionWidth: 2560,
            resolutionHeight: 1440,
            isMain: false
        )

        let builtin = MockScreen(
            frame: NSRect(x: 0, y: 0, width: 1920, height: 1080),
            uuid: "BUILTIN", name: "Built-in Display", isMain: true
        )
        let external = MockScreen(
            frame: NSRect(x: 1920, y: 0, width: 2560, height: 1440),
            uuid: "TARGET-UUID", name: "External", isMain: false
        )

        let match = ScreenMatcher.findBestMatch(for: fingerprint, among: [builtin, external])
        XCTAssertEqual(match?.quality, .exact)
        XCTAssertEqual(match?.screen.frame, external.frame)
    }

    func testPreferUUIDOverName() {
        let fingerprint = ScreenFingerprint(
            displayUUID: "UUID-A",
            localizedName: "Shared Name",
            resolutionWidth: 1920,
            resolutionHeight: 1080,
            isMain: false
        )

        let nameMatch = MockScreen(
            frame: NSRect(x: 0, y: 0, width: 1920, height: 1080),
            uuid: "UUID-B", name: "Shared Name", isMain: false
        )
        let uuidMatch = MockScreen(
            frame: NSRect(x: 1920, y: 0, width: 2560, height: 1440),
            uuid: "UUID-A", name: "Different Name", isMain: false
        )

        let match = ScreenMatcher.findBestMatch(for: fingerprint, among: [nameMatch, uuidMatch])
        XCTAssertEqual(match?.quality, .uuidResChanged)
        XCTAssertEqual(match?.screen.frame, uuidMatch.frame)
    }
}
