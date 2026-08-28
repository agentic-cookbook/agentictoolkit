import AppKit
import AgenticToolkitCore

@MainActor
extension ComposableSettings {

    /// The two kinds of label a settings row uses, in one place.
    ///
    /// Ten row views each carried a private `createLabel` building the identical
    /// `NSTextField(labelWithString:)` with a hardcoded 13pt semibold system
    /// font — the same knowledge written ten times, and ten places a theme could
    /// not reach. They now all come through here, so a theme's `button`/`caption`
    /// styles drive every settings row at once.
    ///
    /// `ThemedLabel` owns its own palette observer, so these repaint on a theme
    /// change without the row view doing anything.

    /// The leading label naming a setting. Uses the `button` text role — these
    /// are control labels, the same category as a button's title.
    public static func makeRowLabel(_ title: String) -> ThemedLabel {
        ThemedLabel(string: title, role: .primaryText, textRole: .button)
    }

    /// The trailing label showing a control's current value (a slider's number,
    /// a stepper's count). Lower emphasis than the row label it annotates.
    ///
    /// `monospacedDigits` picks the theme's `code` style so a value that changes
    /// as you drag doesn't reflow the row on every tick.
    public static func makeValueLabel(
        _ text: String = "",
        monospacedDigits: Bool = false
    ) -> ThemedLabel {
        ThemedLabel(
            string: text,
            role: .secondaryText,
            textRole: monospacedDigits ? .code : .caption
        )
    }
}
