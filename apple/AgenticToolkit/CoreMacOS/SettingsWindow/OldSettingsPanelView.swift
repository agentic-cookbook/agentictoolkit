import AppKit

/// Base view for settings panels. Hosts shared visual utilities such as
/// section headers. Subclasses can extend with panel-specific layout.
@MainActor
open class OldSettingsPanelView: NSView {

    public static func makeHeader(_ title: String) -> NSTextField {
        let label = NSTextField(labelWithString: title)
        label.font = .systemFont(ofSize: 13, weight: .semibold)
        return label
    }
}
