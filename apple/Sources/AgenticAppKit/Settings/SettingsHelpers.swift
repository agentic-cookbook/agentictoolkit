import AppKit

/// Creates a bold section header label for use in settings panes.
@MainActor
public func makeSettingsHeader(_ title: String) -> NSTextField {
    let label = NSTextField(labelWithString: title)
    label.font = .systemFont(ofSize: 13, weight: .semibold)
    return label
}
