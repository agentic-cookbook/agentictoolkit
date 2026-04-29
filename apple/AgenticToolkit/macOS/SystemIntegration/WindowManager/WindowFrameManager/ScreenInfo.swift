import AppKit

/// Abstracts screen geometry so tests can inject mock screens.
public protocol ScreenInfo {
    var frame: NSRect { get }
    var visibleFrame: NSRect { get }
    var fingerprint: ScreenFingerprint { get }
}

/// Provides the current set of screens. Injected into WindowManager for testing.
public protocol ScreenProvider {
    var screens: [ScreenInfo] { get }
    var mainScreen: ScreenInfo? { get }
}
