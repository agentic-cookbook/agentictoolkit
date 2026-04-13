@testable import AgenticAppKit

/// Provides a configurable set of mock screens.
class MockScreenProvider: ScreenProvider {
    var screens: [ScreenInfo]
    var mainScreen: ScreenInfo?

    init(screens: [MockScreen] = []) {
        self.screens = screens
        self.mainScreen = screens.first(where: { $0.fingerprint.isMain })
            ?? screens.first
    }
}
