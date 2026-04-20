import AppKit
import ApplicationServices

/// Walks the user through granting each required permission on first launch.
/// Shows one modal sheet per permission, waits for the user to grant it (polling),
/// then advances to the next. Skips permissions already granted.
final class PermissionWalkthrough {

    /// UserDefaults key tracking whether the walkthrough has completed.
    static let walkthroughCompleteKey = "permission_walkthrough_complete"

    /// Whether the walkthrough has already been completed.
    static var isComplete: Bool {
        UserDefaults.standard.bool(forKey: walkthroughCompleteKey)
    }

    /// Resets the walkthrough so it runs again on next launch.
    static func reset() {
        UserDefaults.standard.removeObject(forKey: walkthroughCompleteKey)
    }

    private var permissions: [AppPermission]
    private var currentIndex = 0
    private var completion: (() -> Void)?
    private var pollingTimer: Timer?
    private var window: NSWindow?
    private var statusDot: NSView?
    private var statusLabel: NSTextField?

    init() {
        self.permissions = AppPermission.allCases
    }

    /// Runs the walkthrough if it hasn't been completed yet.
    /// Calls `completion` when all permissions have been addressed.
    func runIfNeeded(completion: @escaping () -> Void) {
        guard !Self.isComplete else {
            completion()
            return
        }

        // Filter to only permissions not yet granted
        let pending = permissions.filter { !$0.isGranted }
        guard !pending.isEmpty else {
            markComplete()
            completion()
            return
        }

        self.permissions = pending
        self.completion = completion
        self.currentIndex = 0
        showCurrentPermission()
    }

    private func showCurrentPermission() {
        guard currentIndex < permissions.count else {
            markComplete()
            dismissWindow()
            completion?()
            return
        }

        let permission = permissions[currentIndex]

        // If already granted, skip to next
        if permission.isGranted {
            currentIndex += 1
            showCurrentPermission()
            return
        }

        presentPermissionWindow(for: permission)
    }

    private func presentPermissionWindow(for permission: AppPermission) {
        dismissWindow()

        let contentView = NSView(frame: NSRect(x: 0, y: 0, width: 440, height: 310))

        let stack = NSStackView()
        stack.orientation = .vertical
        stack.spacing = 14
        stack.alignment = .centerX
        stack.translatesAutoresizingMaskIntoConstraints = false

        // Icon
        let icon = NSImageView()
        icon.image = NSImage(systemSymbolName: permission.systemImage, accessibilityDescription: nil)
        icon.symbolConfiguration = .init(pointSize: 32, weight: .regular)
        icon.contentTintColor = .controlAccentColor

        // Title
        let title = NSTextField(labelWithString: "\(permission.displayName) Permission")
        title.font = .systemFont(ofSize: 18, weight: .semibold)
        title.alignment = .center

        // Explanation
        let explanation = NSTextField(wrappingLabelWithString: permission.explanation)
        explanation.font = .systemFont(ofSize: 13)
        explanation.textColor = .secondaryLabelColor
        explanation.alignment = .center
        explanation.translatesAutoresizingMaskIntoConstraints = false

        // Settings path
        let pathLabel = NSTextField(labelWithString: permission.settingsPath)
        pathLabel.font = .systemFont(ofSize: 12, weight: .medium)
        pathLabel.textColor = .tertiaryLabelColor
        pathLabel.alignment = .center

        // Status indicator
        let dot = NSView()
        dot.wantsLayer = true
        dot.layer?.cornerRadius = 5
        dot.layer?.backgroundColor = NSColor.systemOrange.cgColor
        dot.translatesAutoresizingMaskIntoConstraints = false

        let statusText = NSTextField(labelWithString: "Not Granted")
        statusText.font = .systemFont(ofSize: 12, weight: .medium)
        statusText.textColor = .systemOrange

        let statusRow = NSStackView(views: [dot, statusText])
        statusRow.orientation = .horizontal
        statusRow.spacing = 8
        statusRow.alignment = .centerY

        self.statusDot = dot
        self.statusLabel = statusText

        // Progress indicator
        let progressLabel = NSTextField(labelWithString: "Permission \(currentIndex + 1) of \(permissions.count)")
        progressLabel.font = .systemFont(ofSize: 11)
        progressLabel.textColor = .tertiaryLabelColor

        // Buttons
        let openButton = NSButton(title: "Open System Settings", target: self, action: #selector(openSettingsClicked))
        openButton.bezelStyle = .rounded
        openButton.controlSize = .large

        let skipButton = NSButton(title: "Skip", target: self, action: #selector(skipClicked))
        skipButton.bezelStyle = .rounded
        skipButton.controlSize = .large

        let buttonRow = NSStackView(views: [openButton, skipButton])
        buttonRow.orientation = .horizontal
        buttonRow.spacing = 12

        stack.addArrangedSubview(icon)
        stack.addArrangedSubview(title)
        stack.addArrangedSubview(explanation)
        stack.addArrangedSubview(pathLabel)
        stack.addArrangedSubview(statusRow)
        stack.addArrangedSubview(buttonRow)
        stack.addArrangedSubview(progressLabel)

        contentView.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.centerXAnchor.constraint(equalTo: contentView.centerXAnchor),
            stack.centerYAnchor.constraint(equalTo: contentView.centerYAnchor),
            explanation.widthAnchor.constraint(lessThanOrEqualToConstant: 340),
            dot.widthAnchor.constraint(equalToConstant: 10),
            dot.heightAnchor.constraint(equalToConstant: 10),
        ])

        let w = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 440, height: 310),
            styleMask: [.titled],
            backing: .buffered,
            defer: false
        )
        w.title = "AgenticPluginTester Setup"
        w.contentView = contentView
        w.center()
        w.isReleasedWhenClosed = false
        w.level = .floating
        w.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)

        self.window = w

        // Request the permission (triggers system prompt for notifications, opens settings for others)
        permission.request { [weak self] granted in
            if granted {
                self?.handleGranted()
            }
        }

        // Start polling for permission grant
        startPolling(for: permission)
    }

    private func startPolling(for permission: AppPermission) {
        pollingTimer?.invalidate()
        pollingTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            guard let self else { return }
            if permission.isGranted {
                self.handleGranted()
            }
        }
    }

    private func handleGranted() {
        pollingTimer?.invalidate()
        pollingTimer = nil
        statusDot?.layer?.backgroundColor = NSColor.systemGreen.cgColor
        statusLabel?.stringValue = "Granted"
        statusLabel?.textColor = .systemGreen

        // Auto-advance after a brief pause
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) { [weak self] in
            self?.advanceToNext()
        }
    }

    private func advanceToNext() {
        pollingTimer?.invalidate()
        pollingTimer = nil
        currentIndex += 1
        showCurrentPermission()
    }

    private func dismissWindow() {
        pollingTimer?.invalidate()
        pollingTimer = nil
        window?.orderOut(nil)
        window = nil
        statusDot = nil
        statusLabel = nil
    }

    private func markComplete() {
        UserDefaults.standard.set(true, forKey: Self.walkthroughCompleteKey)
    }

    // MARK: - Actions

    @objc private func openSettingsClicked() {
        guard currentIndex < permissions.count else { return }
        permissions[currentIndex].openSettings()
    }

    @objc private func skipClicked() {
        advanceToNext()
    }
}
