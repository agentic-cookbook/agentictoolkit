import AppKit

/// Bespoke card-style row for a single `AppPermission`. Shows the permission's
/// icon, name, description, current grant status, and an "Open Settings"
/// button that jumps to the relevant System Settings pane. `refresh()`
/// re-reads the granted state — `PermissionsSettingsPanelViewController` calls it
/// on a polling timer.
@MainActor
public final class PermissionRowView: NSView, SettingsViewProtocol {

    public let permission: AppPermission

    private let titleLabel: NSTextField
    private let statusDot: NSView
    private let statusLabel: NSTextField

    public init(permission: AppPermission) {
        self.permission = permission
        self.titleLabel = NSTextField(labelWithString: permission.displayName)
        self.statusDot = NSView()
        self.statusLabel = NSTextField(labelWithString: "Checking…")

        super.init(frame: .zero)
        self.translatesAutoresizingMaskIntoConstraints = false
        self.setContentHuggingPriority(.defaultHigh, for: .vertical)
        self.setContentCompressionResistancePriority(.defaultHigh, for: .vertical)
        self.wantsLayer = true
        self.layer?.backgroundColor = NSColor.white.withAlphaComponent(0.03).cgColor
        self.layer?.cornerRadius = 8
        self.layer?.borderColor = NSColor.white.withAlphaComponent(0.06).cgColor
        self.layer?.borderWidth = 0.5

        let icon = NSImageView()
        icon.image = NSImage(systemSymbolName: permission.systemImage, accessibilityDescription: nil)
        icon.symbolConfiguration = .init(pointSize: 16, weight: .regular)
        icon.contentTintColor = .secondaryLabelColor
        icon.translatesAutoresizingMaskIntoConstraints = false

        self.titleLabel.font = .systemFont(ofSize: 13, weight: .medium)
        self.titleLabel.translatesAutoresizingMaskIntoConstraints = false

        let descLabel = NSTextField(wrappingLabelWithString: permission.explanation)
        descLabel.font = .systemFont(ofSize: 11)
        descLabel.textColor = .secondaryLabelColor
        descLabel.translatesAutoresizingMaskIntoConstraints = false

        self.statusDot.wantsLayer = true
        self.statusDot.layer?.cornerRadius = 4
        self.statusDot.translatesAutoresizingMaskIntoConstraints = false

        self.statusLabel.font = .systemFont(ofSize: 11, weight: .medium)
        self.statusLabel.translatesAutoresizingMaskIntoConstraints = false

        let statusRow = NSStackView(views: [self.statusDot, self.statusLabel])
        statusRow.orientation = .horizontal
        statusRow.spacing = 6
        statusRow.alignment = .centerY
        statusRow.translatesAutoresizingMaskIntoConstraints = false

        let button = NSButton(title: "Open Settings", target: self, action: #selector(openSettings))
        button.bezelStyle = .rounded
        button.controlSize = .small
        button.translatesAutoresizingMaskIntoConstraints = false

        self.addSubview(icon)
        self.addSubview(self.titleLabel)
        self.addSubview(descLabel)
        self.addSubview(statusRow)
        self.addSubview(button)

        NSLayoutConstraint.activate([
            self.heightAnchor.constraint(greaterThanOrEqualToConstant: 72),

            icon.leadingAnchor.constraint(equalTo: self.leadingAnchor, constant: 12),
            icon.topAnchor.constraint(equalTo: self.topAnchor, constant: 12),
            icon.widthAnchor.constraint(equalToConstant: 24),
            icon.heightAnchor.constraint(equalToConstant: 24),

            self.titleLabel.leadingAnchor.constraint(equalTo: icon.trailingAnchor, constant: 10),
            self.titleLabel.topAnchor.constraint(equalTo: self.topAnchor, constant: 10),

            descLabel.leadingAnchor.constraint(equalTo: self.titleLabel.leadingAnchor),
            descLabel.topAnchor.constraint(equalTo: self.titleLabel.bottomAnchor, constant: 2),
            descLabel.trailingAnchor.constraint(equalTo: button.leadingAnchor, constant: -12),

            statusRow.leadingAnchor.constraint(equalTo: self.titleLabel.leadingAnchor),
            statusRow.topAnchor.constraint(equalTo: descLabel.bottomAnchor, constant: 6),
            statusRow.bottomAnchor.constraint(equalTo: self.bottomAnchor, constant: -10),

            self.statusDot.widthAnchor.constraint(equalToConstant: 8),
            self.statusDot.heightAnchor.constraint(equalToConstant: 8),

            button.trailingAnchor.constraint(equalTo: self.trailingAnchor, constant: -12),
            button.centerYAnchor.constraint(equalTo: self.centerYAnchor),
        ])

        refresh()
    }

    public override init(frame frameRect: NSRect) {
        fatalError("init(frame frameRect: NSRect")
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    /// Re-reads `permission.isGranted` and updates the status dot + label.
    public func refresh() {
        if permission.isGranted {
            self.statusDot.layer?.backgroundColor = NSColor.systemGreen.cgColor
            self.statusLabel.stringValue = "Granted"
            self.statusLabel.textColor = .systemGreen
        } else {
            self.statusDot.layer?.backgroundColor = NSColor.systemOrange.cgColor
            self.statusLabel.stringValue = "Not Granted"
            self.statusLabel.textColor = .systemOrange
        }
    }

    @objc private func openSettings() {
        permission.openSettings()
    }
}
