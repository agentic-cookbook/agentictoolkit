import Foundation

/// Lightweight wrapper around `NSAppleScript` that surfaces compile and runtime
/// errors as structured values instead of returning `nil` and dropping context.
///
/// Usage:
/// ```swift
/// switch AppleScriptRunner.run("tell application \"Finder\" to get name of every disk") {
/// case .success(let result): print(result ?? "")
/// case .compileFailed: print("Source did not parse")
/// case .runtimeFailed(let message, let number): print("AppleScript error \(number): \(message)")
/// }
/// ```
public enum AppleScriptRunner {

    /// Outcome of a single AppleScript execution.
    public enum Result: Equatable {
        /// Script ran. Result string is the value of `result.stringValue` (may be nil
        /// for scripts that don't return text).
        case success(String?)
        /// `NSAppleScript(source:)` returned nil — the source didn't parse.
        case compileFailed
        /// Script compiled but `executeAndReturnError` populated the error dict.
        case runtimeFailed(message: String, number: Int)
    }

    /// Compiles and executes the given AppleScript source on the calling thread.
    /// `NSAppleScript` requires the main thread on some macOS versions; callers
    /// running on a background queue should marshal to main if needed.
    public static func run(_ source: String) -> Result {
        guard let script = NSAppleScript(source: source) else { return .compileFailed }
        var error: NSDictionary?
        let descriptor = script.executeAndReturnError(&error)
        if let error {
            let message = error[NSAppleScript.errorMessage] as? String ?? "unknown error"
            let number = error[NSAppleScript.errorNumber] as? Int ?? 0
            return .runtimeFailed(message: message, number: number)
        }
        return .success(descriptor.stringValue)
    }
}
