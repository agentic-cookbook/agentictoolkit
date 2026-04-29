import AppKit

extension ComposableSettings {

    /// `TextEditView` variant backed by an `NSSecureTextField` so the entry is
    /// dot-masked. Use for API keys, passwords, and other secrets that are
    /// still routed through a `UserSetting<String>` (typically one whose
    /// backing storage is the keychain — `isSecure: true`).
    @MainActor
    public final class SecureTextEditView: TextEditView {
        public override class func makeTextField(initialValue: String) -> NSTextField {
            NSSecureTextField(string: initialValue)
        }
    }
}
