import AppKit
@testable import AgenticAppKit

/// A mock screen for testing proportional positioning across screen changes.
struct MockScreen: ScreenInfo {
    let frame: NSRect
    let visibleFrame: NSRect
    let fingerprint: ScreenFingerprint

    init(
        frame: NSRect,
        visibleFrame: NSRect? = nil,
        uuid: String? = nil,
        name: String? = nil,
        isMain: Bool = false
    ) {
        self.frame = frame
        self.visibleFrame = visibleFrame ?? frame
        self.fingerprint = ScreenFingerprint(
            displayUUID: uuid,
            localizedName: name,
            resolutionWidth: frame.width,
            resolutionHeight: frame.height,
            isMain: isMain
        )
    }
}
