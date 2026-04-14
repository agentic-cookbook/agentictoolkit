import AppKit
import Combine
import AgenticPluginSDK
import AgenticUI

// MARK: - Settings Topic

enum SettingsTopic: String, CaseIterable {
    case ai = "AI"
    case appearance = "Appearance"
    case profiles = "Profiles"
    case plugins = "Plugins"
    case system = "System"

    var systemImage: String {
        switch self {
        case .ai: return "brain"
        case .appearance: return "paintbrush"
        case .profiles: return "swatchpalette"
        case .plugins: return "puzzlepiece.fill"
        case .system: return "lock.shield"
        }
    }
}

// MARK: - Settings View (NSSplitView-based)

final class SettingsView: NSView, NSTableViewDataSource, NSTableViewDelegate, NSSplitViewDelegate {
    private let viewModel: SettingsViewModel
    private let aiSettingsViewModel: AISettingsViewModel
    private var cancellables = Set<AnyCancellable>()
    private let topics = SettingsTopic.allCases
    private var selectedTopic: SettingsTopic = .ai

    private let splitView = NSSplitView()
    private let sidebarTableView = NSTableView()
    private let detailContainer: NSScrollView = {
        let sv = NSScrollView()
        let clip = FlippedClipView()
        sv.contentView = clip
        return sv
    }()
    private var currentDetailView: NSView?
    private var needsInitialDividerPosition = true

    init(viewModel: SettingsViewModel, aiSettingsViewModel: AISettingsViewModel) {
        self.viewModel = viewModel
        self.aiSettingsViewModel = aiSettingsViewModel
        super.init(frame: .zero)
        setupViews()
        selectTopic(.ai)
    }

    override func layout() {
        super.layout()
        if needsInitialDividerPosition && bounds.width > 0 {
            needsInitialDividerPosition = false
            splitView.setPosition(Self.sidebarWidth, ofDividerAt: 0)
        }
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

    private static let sidebarWidth: CGFloat = 180

    private func setupViews() {
        // Sidebar table
        let column = NSTableColumn(identifier: NSUserInterfaceItemIdentifier("topic"))
        column.title = ""
        sidebarTableView.addTableColumn(column)
        sidebarTableView.headerView = nil
        sidebarTableView.dataSource = self
        sidebarTableView.delegate = self
        sidebarTableView.rowHeight = 28
        sidebarTableView.style = .sourceList
        sidebarTableView.selectionHighlightStyle = .sourceList

        let sidebarScroll = NSScrollView()
        sidebarScroll.documentView = sidebarTableView
        sidebarScroll.hasVerticalScroller = true
        sidebarScroll.drawsBackground = false
        sidebarScroll.translatesAutoresizingMaskIntoConstraints = false

        // Detail scroll view
        detailContainer.hasVerticalScroller = true
        detailContainer.drawsBackground = false
        detailContainer.translatesAutoresizingMaskIntoConstraints = false

        // Split view — sidebar is fixed width, detail absorbs all resizing
        splitView.isVertical = true
        splitView.dividerStyle = .thin
        splitView.delegate = self
        splitView.translatesAutoresizingMaskIntoConstraints = false
        splitView.addArrangedSubview(sidebarScroll)
        splitView.addArrangedSubview(detailContainer)
        splitView.setHoldingPriority(.required, forSubviewAt: 0)
        splitView.setHoldingPriority(.defaultLow, forSubviewAt: 1)

        addSubview(splitView)
        NSLayoutConstraint.activate([
            splitView.topAnchor.constraint(equalTo: topAnchor),
            splitView.leadingAnchor.constraint(equalTo: leadingAnchor),
            splitView.trailingAnchor.constraint(equalTo: trailingAnchor),
            splitView.bottomAnchor.constraint(equalTo: bottomAnchor),
        ])

        sidebarTableView.selectRowIndexes(IndexSet(integer: 0), byExtendingSelection: false)
    }

    private func selectTopic(_ topic: SettingsTopic) {
        selectedTopic = topic
        currentDetailView?.removeFromSuperview()

        let pane: NSView
        switch topic {
        case .appearance: pane = AppearanceSettingsPane(viewModel: viewModel)
        case .ai: pane = AISettingsView(viewModel: aiSettingsViewModel)
        case .profiles: pane = ProfilesSettingsView()
        case .plugins: pane = PluginsSettingsPane(pluginManager: viewModel.pluginManager)
        case .system: pane = SystemSettingsPane(viewModel: viewModel)
        }

        pane.translatesAutoresizingMaskIntoConstraints = false

        let padding: CGFloat = 20
        let wrapper = NSView()
        wrapper.translatesAutoresizingMaskIntoConstraints = false
        wrapper.addSubview(pane)
        NSLayoutConstraint.activate([
            pane.topAnchor.constraint(equalTo: wrapper.topAnchor, constant: padding),
            pane.leadingAnchor.constraint(equalTo: wrapper.leadingAnchor, constant: padding),
            pane.trailingAnchor.constraint(equalTo: wrapper.trailingAnchor, constant: -padding),
            pane.bottomAnchor.constraint(equalTo: wrapper.bottomAnchor, constant: -padding),
        ])

        detailContainer.documentView = wrapper

        // Pin wrapper width to clip view so content fills available width
        if let clipView = detailContainer.contentView as? NSClipView {
            wrapper.widthAnchor.constraint(equalTo: clipView.widthAnchor).isActive = true
        }

        currentDetailView = wrapper
    }

    // MARK: - NSTableViewDataSource

    func numberOfRows(in tableView: NSTableView) -> Int { topics.count }

    // MARK: - NSTableViewDelegate

    func tableView(_ tableView: NSTableView, viewFor tableColumn: NSTableColumn?, row: Int) -> NSView? {
        let topic = topics[row]
        let identifier = NSUserInterfaceItemIdentifier("TopicCell")
        let cell = tableView.makeView(withIdentifier: identifier, owner: nil) as? NSTableCellView ?? {
            let c = NSTableCellView()
            c.identifier = identifier
            let imageView = NSImageView()
            imageView.translatesAutoresizingMaskIntoConstraints = false
            let textField = NSTextField(labelWithString: "")
            textField.translatesAutoresizingMaskIntoConstraints = false
            c.addSubview(imageView)
            c.addSubview(textField)
            c.imageView = imageView
            c.textField = textField
            NSLayoutConstraint.activate([
                imageView.leadingAnchor.constraint(equalTo: c.leadingAnchor, constant: 4),
                imageView.centerYAnchor.constraint(equalTo: c.centerYAnchor),
                imageView.widthAnchor.constraint(equalToConstant: 16),
                imageView.heightAnchor.constraint(equalToConstant: 16),
                textField.leadingAnchor.constraint(equalTo: imageView.trailingAnchor, constant: 6),
                textField.centerYAnchor.constraint(equalTo: c.centerYAnchor),
                textField.trailingAnchor.constraint(lessThanOrEqualTo: c.trailingAnchor, constant: -4),
            ])
            return c
        }()

        cell.textField?.stringValue = topic.rawValue
        cell.textField?.font = .systemFont(ofSize: 13)
        cell.imageView?.image = NSImage(systemSymbolName: topic.systemImage, accessibilityDescription: nil)
        return cell
    }

    func tableViewSelectionDidChange(_ notification: Notification) {
        let row = sidebarTableView.selectedRow
        guard row >= 0, row < topics.count else { return }
        selectTopic(topics[row])
    }

    // MARK: - NSSplitViewDelegate

    func splitView(_ splitView: NSSplitView, canCollapseSubview subview: NSView) -> Bool { false }

    func splitView(_ splitView: NSSplitView, constrainMinCoordinate proposedMinimumPosition: CGFloat, ofSubviewAt dividerIndex: Int) -> CGFloat {
        Self.sidebarWidth
    }

    func splitView(_ splitView: NSSplitView, constrainMaxCoordinate proposedMaximumPosition: CGFloat, ofSubviewAt dividerIndex: Int) -> CGFloat {
        Self.sidebarWidth
    }
}

// MARK: - Appearance Settings Pane

final class AppearanceSettingsPane: NSView {
    private let viewModel: SettingsViewModel
    private var cancellables = Set<AnyCancellable>()

    init(viewModel: SettingsViewModel) {
        self.viewModel = viewModel
        super.init(frame: .zero)
        setupViews()
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

    private func setupViews() {
        let stack = NSStackView()
        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = 20
        stack.translatesAutoresizingMaskIntoConstraints = false

        // Appearance mode
        let modeHeader = makeHeader("Appearance")

        let lightRadio = NSButton(radioButtonWithTitle: "Light", target: self, action: #selector(modeChanged(_:)))
        lightRadio.tag = 0
        let darkRadio = NSButton(radioButtonWithTitle: "Dark", target: self, action: #selector(modeChanged(_:)))
        darkRadio.tag = 1
        let autoRadio = NSButton(radioButtonWithTitle: "Auto (System)", target: self, action: #selector(modeChanged(_:)))
        autoRadio.tag = 2

        switch viewModel.appearanceMode {
        case "light": lightRadio.state = .on
        case "dark": darkRadio.state = .on
        default: autoRadio.state = .on
        }

        let radioStack = NSStackView(views: [lightRadio, darkRadio, autoRadio])
        radioStack.orientation = .vertical
        radioStack.alignment = .leading
        radioStack.spacing = 4

        let divider = NSBox()
        divider.boxType = .separator

        // Text size
        let sizeHeader = makeHeader("Text Size")

        let slider = NSSlider(value: viewModel.textSize, minValue: -4, maxValue: 4, target: self, action: #selector(textSizeChanged(_:)))
        slider.numberOfTickMarks = 9
        slider.allowsTickMarkValuesOnly = true
        slider.translatesAutoresizingMaskIntoConstraints = false

        let smallA = NSTextField(labelWithString: "A")
        smallA.font = .systemFont(ofSize: 10)
        smallA.textColor = .secondaryLabelColor

        let bigA = NSTextField(labelWithString: "A")
        bigA.font = .systemFont(ofSize: 18)
        bigA.textColor = .secondaryLabelColor

        let sliderRow = NSStackView(views: [smallA, slider, bigA])
        sliderRow.orientation = .horizontal
        sliderRow.spacing = 12

        let preview = NSTextField(labelWithString: "Example")
        preview.font = .systemFont(ofSize: max(9, 13 + viewModel.textSize))
        preview.alignment = .center
        preview.wantsLayer = true
        preview.layer?.backgroundColor = NSColor.quaternaryLabelColor.withAlphaComponent(0.3).cgColor
        preview.layer?.cornerRadius = 6
        preview.translatesAutoresizingMaskIntoConstraints = false

        stack.addArrangedSubview(modeHeader)
        stack.addArrangedSubview(radioStack)
        stack.addArrangedSubview(divider)
        stack.addArrangedSubview(sizeHeader)
        stack.addArrangedSubview(sliderRow)
        stack.addArrangedSubview(preview)

        addSubview(stack)
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: topAnchor),
            stack.leadingAnchor.constraint(equalTo: leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: trailingAnchor),
            stack.bottomAnchor.constraint(equalTo: bottomAnchor),
            divider.widthAnchor.constraint(equalTo: stack.widthAnchor),
            sliderRow.widthAnchor.constraint(equalTo: stack.widthAnchor),
            preview.widthAnchor.constraint(equalTo: stack.widthAnchor),
            preview.heightAnchor.constraint(equalToConstant: 32),
        ])
    }

    @objc private func modeChanged(_ sender: NSButton) {
        let mode: String
        switch sender.tag {
        case 0: mode = "light"
        case 1: mode = "dark"
        default: mode = "auto"
        }
        viewModel.appearanceMode = mode
    }

    @objc private func textSizeChanged(_ sender: NSSlider) {
        viewModel.textSize = sender.doubleValue
    }
}

// MARK: - System Settings Pane

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

        stack.addArrangedSubview(makeHeader("Permissions"))

        let hint = NSTextField(wrappingLabelWithString:
            "AgenticToolkit needs the following permissions to monitor and activate Claude Code sessions.")
        hint.font = .systemFont(ofSize: 12)
        hint.textColor = .secondaryLabelColor
        stack.addArrangedSubview(hint)

        for permission in permissions {
            let row = makePermissionRow(permission)
            stack.addArrangedSubview(row)
            row.widthAnchor.constraint(equalTo: stack.widthAnchor).isActive = true
        }

        // Reset walkthrough button
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

        // Icon
        let icon = NSImageView()
        icon.image = NSImage(systemSymbolName: permission.systemImage, accessibilityDescription: nil)
        icon.symbolConfiguration = .init(pointSize: 16, weight: .regular)
        icon.contentTintColor = .secondaryLabelColor
        icon.translatesAutoresizingMaskIntoConstraints = false

        // Title + description
        let titleLabel = NSTextField(labelWithString: permission.displayName)
        titleLabel.font = .systemFont(ofSize: 13, weight: .medium)
        titleLabel.translatesAutoresizingMaskIntoConstraints = false

        let descLabel = NSTextField(wrappingLabelWithString: permission.explanation)
        descLabel.font = .systemFont(ofSize: 11)
        descLabel.textColor = .secondaryLabelColor
        descLabel.translatesAutoresizingMaskIntoConstraints = false

        // Status dot + label
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

        // Open Settings button
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
        alert.informativeText = "The permission walkthrough will run again the next time AgenticToolkit launches."
        alert.alertStyle = .informational
        alert.addButton(withTitle: "OK")
        alert.runModal()
    }

}

// MARK: - Flipped Clip View

/// An NSClipView subclass with a flipped coordinate system so that
/// scroll view document content is pinned to the top-left.
private final class FlippedClipView: NSClipView {
    override var isFlipped: Bool { true }
}

// MARK: - Shared Helpers

private func makeHeader(_ title: String) -> NSTextField {
    let label = NSTextField(labelWithString: title)
    label.font = .systemFont(ofSize: 13, weight: .semibold)
    return label
}
