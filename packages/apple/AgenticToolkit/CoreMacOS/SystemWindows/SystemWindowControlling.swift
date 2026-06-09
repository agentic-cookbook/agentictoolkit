import AgenticToolkitCore
import CoreGraphics
import Foundation

/// Protocol abstracting control of other applications' windows.
///
/// This allows higher-level orchestration (e.g. a context manager) to be tested
/// without requiring real windows or Accessibility permissions. The real
/// SystemWindowManager conforms to this protocol, and tests can provide a mock.
public protocol SystemWindowControlling {
    /// Returns information about all currently on-screen windows.
    func listWindows() -> [SystemWindowInfo]

    /// Returns information about all windows, including off-screen ones.
    func listAllWindows() -> [SystemWindowInfo]

    /// Moves a window to the specified position.
    func move(windowID: UInt32, to point: CGPoint) throws

    /// Resizes a window to the specified size.
    func resize(windowID: UInt32, to size: CGSize) throws

    /// Brings a window to the front and focuses its owning application.
    func focus(windowID: UInt32) throws

    /// Moves and resizes a window to the specified frame.
    func setFrame(windowID: UInt32, to frame: CGRect) throws
}
