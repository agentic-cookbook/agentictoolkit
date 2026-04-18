import AppKit
import Foundation

/// Base class for `NSScriptCommand` subclasses that need to run on the main
/// actor — which is nearly all of them, since they typically touch AppKit
/// state (windows, view controllers, etc.).
///
/// AppleScript dispatches commands on an arbitrary thread, so subclasses
/// would otherwise need to paper over the Sendable gap manually with
/// `@unchecked Sendable` + `MainActor.assumeIsolated { ... }` on every
/// command. This base absorbs that boilerplate: subclasses override the
/// `@MainActor` `performMain()` method and return the same type they'd
/// return from `performDefaultImplementation()`.
///
/// Example:
/// ```swift
/// @objc(StenographerOpenSettingsCommand)
/// public final class StenographerOpenSettingsCommand: MainActorScriptCommand {
///     public override func performMain() -> Any? {
///         SettingsWindowController.present(...)
///         return SettingsWindowController.current != nil
///     }
/// }
/// ```
///
/// The assumption-of-isolation is safe because Cocoa Scripting always
/// invokes command handlers via `NSScriptCommand.performDefaultImplementation`
/// on the main thread when the script suite is registered in a `.app`'s
/// `Info.plist`. The `@unchecked Sendable` is required because
/// `NSScriptCommand` itself carries mutable state and isn't marked Sendable.
open class MainActorScriptCommand: NSScriptCommand, @unchecked Sendable {

    /// Override this to implement the command. Runs on the main actor.
    /// Default implementation returns `nil`.
    @MainActor
    open func performMain() -> Any? { nil }

    public override func performDefaultImplementation() -> Any? {
        // Cocoa Scripting invokes this on the main thread, so hopping onto
        // the main actor here is a no-op at runtime. The indirect via
        // `nonisolated(unsafe)` is needed because `Any?` is not Sendable
        // and Swift 6 otherwise rejects the return.
        nonisolated(unsafe) var result: Any?
        MainActor.assumeIsolated {
            result = self.performMain()
        }
        return result
    }
}
