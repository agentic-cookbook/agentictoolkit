import ApplicationServices

/// App-neutral wrapper around the macOS Accessibility (AX) trust check.
///
/// The SystemWindows engine needs Accessibility permission to read window
/// titles and to move, park, and raise other apps' windows. This helper is the
/// single place hosts (apps and toolkit features) consult that permission, so
/// each one doesn't re-derive the public AX trust API.
///
/// It is intentionally separate from `SystemWindowManager`: the engine stays
/// permission-agnostic and only throws `SystemWindowControlError`
/// `.accessibilityNotAvailable`; the UI decides when to check and when to
/// prompt.
public enum SystemAccessibilityPermission {
    /// Whether this process is currently trusted for Accessibility.
    ///
    /// Read-only and side-effect free — it never shows the system prompt, so it
    /// is safe to poll (e.g. on `didBecomeActive`). Use `request()` to surface
    /// the prompt.
    public static var isGranted: Bool {
        AXIsProcessTrusted()
    }

    /// Prompts the user to grant Accessibility permission, surfacing the system
    /// dialog and the Accessibility pane of System Settings.
    ///
    /// Passing the prompt option reliably opens the correct pane across macOS
    /// versions. Call only from user-initiated actions. Returns the current
    /// trust state (which is `false` until the user grants and the process is
    /// re-evaluated).
    @discardableResult
    public static func request() -> Bool {
        // Use the string-literal key rather than the SDK's global `var`
        // `kAXTrustedCheckOptionPrompt`, which is not concurrency-safe to reference.
        let options = ["AXTrustedCheckOptionPrompt": true] as CFDictionary
        return AXIsProcessTrustedWithOptions(options)
    }
}
