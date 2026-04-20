import AppKit
import AgenticAppKit

final class SystemSettingsPane: NSView {
    private let viewModel: SettingsViewModel
    private var refreshTimer: Timer?
    private var permissionRows: [(label: NSTextField, statusDot: NSView, statusLabel: NSTextField)] = []
    private let permissions = AppPermission.allCases

    init(viewModel: SettingsViewModel) {
        self.viewModel = viewModel
        super.init(frame: .zero)
        setupViews()
        startPolling()
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

    deinit {
        refreshTimer?.invalidate()
    }

    private func setupViews() {
        let stack = NSStackView()
        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = 20
        stack.translatesAutoresizingMaskIntoConstraints = false

        stack.addArrangedSubview(makeSettingsHeader("Permissions"))

        let hint = NSTextField(wrappingLabelWithString:
            "AgenticPluginTester needs the following permissions to monitor and activate Claude Code sessions.")
        hint.font = .systemFont(ofSize: 12)
        hint.textColor = .secondaryLabelColor
        stack.addArrangedSubview(hint)

        for permission in permissions {
            let row = makePermissionRow(permission)
            stack.addArrangedSubview(row)
            row.widthAnchor.constraint(equalTo: stack.widthAnchor).isActive = true
        }

        let resetButton = NSButton(title: "Reset Permission Walkthrough", target: self, action: #selector(resetWalkthrough))
        resetButton.bezelStyle = .rounded
        resetButton.controlSize = .regular
        stack.addArrangedSubview(resetButton)

        let resetHint = NSTextField(wrappingLabelWithString:
            "Re-runs the first-launch permission walkthrough on next app launch.")
        resetHint.font = .systemFont(ofSize: 11)
        resetHint.textColor = .tertiaryLabelColor
        stack.addArrangedSubview(resetHint)

        addSubview(stack)
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: topAnchor),
            stack.leadingAnchor.constraint(equalTo: leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: trailingAnchor),
            stack.bottomAnchor.constraint(equalTo: bottomAnchor),
            hint.widthAnchor.constraint(equalTo: stack.widthAnchor),
            resetHint.widthAnchor.constraint(equalTo: stack.widthAnchor),
        ])

        updateStatuses()
    }

    private func makePermissionRow(_ permission: AppPermission) -> NSView {
        let container = NSView()
        container.wantsLayer = true
        container.layer?.backgroundColor = NSColor.white.withAlphaComponent(0.03).cgColor
        container.layer?.cornerRadius = 8
        container.layer?.borderColor = NSColor.white.withAlphaComponent(0.06).cgColor
        container.layer?.borderWidth = 0.5
        container.translatesAutoresizingMaskIntoConstraints = false

        let icon = NSImageView()
        icon.image = NSImage(systemSymbolName: permission.systemImage, accessibilityDescription: nil)
        icon.symbolConfiguration = .init(pointSize: 16, weight: .regular)
        icon.contentTintColor = .secondaryLabelColor
        icon.translatesAutoresizingMaskIntoConstraints = false

        let titleLabel = NSTextField(labelWithString: permission.displayName)
        titleLabel.font = .systemFont(ofSize: 13, weight: .medium)
        titleLabel.translatesAutoresizingMaskIntoConstraints = false

        let descLabel = NSTextField(wrappingLabelWithString: permission.explanation)
        descLabel.font = .systemFont(ofSize: 11)
        descLabel.textColor = .secondaryLabelColor
        descLabel.translatesAutoresizingMaskIntoConstraints = false

        let statusDot = NSView()
        statusDot.wantsLayer = true
        statusDot.layer?.cornerRadius = 4
        statusDot.translatesAutoresizingMaskIntoConstraints = false

        let statusLabel = NSTextField(labelWithString: "Checking...")
        statusLabel.font = .systemFont(ofSize: 11, weight: .medium)
        statusLabel.translatesAutoresizingMaskIntoConstraints = false

        let statusRow = NSStackView(views: [statusDot, statusLabel])
        statusRow.orientation = .horizontal
        statusRow.spacing = 6
        statusRow.alignment = .centerY
        statusRow.translatesAutoresizingMaskIntoConstraints = false

        let button = NSButton(title: "Open Settings", target: self, action: #selector(openPermissionSettings(_:)))
        button.bezelStyle = .rounded
        button.controlSize = .small
        button.tag = permission.rawValue
        button.translatesAutoresizingMaskIntoConstraints = false

        container.addSubview(icon)
        container.addSubview(titleLabel)
        container.addSubview(descLabel)
        container.addSubview(statusRow)
        container.addSubview(button)

        NSLayoutConstraint.activate([
            container.heightAnchor.constraint(greaterThanOrEqualToConstant: 72),

            icon.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: 12),
            icon.topAnchor.constraint(equalTo: container.topAnchor, constant: 12),
            icon.widthAnchor.constraint(equalToConstant: 24),
            icon.heightAnchor.constraint(equalToConstant: 24),

            titleLabel.leadingAnchor.constraint(equalTo: icon.trailingAnchor, constant: 10),
            titleLabel.topAnchor.constraint(equalTo: container.topAnchor, constant: 10),

            descLabel.leadingAnchor.constraint(equalTo: titleLabel.leadingAnchor),
            descLabel.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 2),
            descLabel.trailingAnchor.constraint(equalTo: button.leadingAnchor, constant: -12),

            statusRow.leadingAnchor.constraint(equalTo: titleLabel.leadingAnchor),
            statusRow.topAnchor.constraint(equalTo: descLabel.bottomAnchor, constant: 6),
            statusRow.bottomAnchor.constraint(lessThanOrEqualTo: container.bottomAnchor, constant: -10),

            statusDot.widthAnchor.constraint(equalToConstant: 8),
            statusDot.heightAnchor.constraint(equalToConstant: 8),

            button.trailingAnchor.constraint(equalTo: container.trailingAnchor, constant: -12),
            button.centerYAnchor.constraint(equalTo: container.centerYAnchor),
        ])

        permissionRows.append((label: titleLabel, statusDot: statusDot, statusLabel: statusLabel))
        return container
    }

    private func updateStatuses() {
        for (index, permission) in permissions.enumerated() {
            guard index < permissionRows.count else { continue }
            let row = permissionRows[index]
            let granted = permission.isGranted

            if granted {
                row.statusDot.layer?.backgroundColor = NSColor.systemGreen.cgColor
                row.statusLabel.stringValue = "Granted"
                row.statusLabel.textColor = .systemGreen
            } else {
                row.statusDot.layer?.backgroundColor = NSColor.systemOrange.cgColor
                row.statusLabel.stringValue = "Not Granted"
                row.statusLabel.textColor = .systemOrange
            }
        }
    }

    private func startPolling() {
        refreshTimer = Timer.scheduledTimer(withTimeInterval: 2.0, repeats: true) { [weak self] _ in
            self?.updateStatuses()
        }
    }

    @objc private func openPermissionSettings(_ sender: NSButton) {
        guard let permission = AppPermission(rawValue: sender.tag) else { return }
        permission.openSettings()
    }

    @objc private func resetWalkthrough() {
        PermissionWalkthrough.reset()

        let alert = NSAlert()
        alert.messageText = "Permission Walkthrough Reset"
        alert.informativeText = "The permission walkthrough will run again the next time AgenticPluginTester launches."
        alert.alertStyle = .informational
        alert.addButton(withTitle: "OK")
        alert.runModal()
    }
}
