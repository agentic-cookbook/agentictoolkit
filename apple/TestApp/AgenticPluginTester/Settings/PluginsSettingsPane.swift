import AppKit
import AgenticPluginSDK

// MARK: - PluginDescriptor

/// Lightweight description of an installed plugin used by the settings UI.
/// Built from live PluginManager data at display time.
struct PluginDescriptor {
    let identifier: String
    let displayName: String
    let version: String
    let iconName: String        // SF Symbol
    let requiresAPIKey: Bool
    let capabilities: [String]
    let availableModels: [String]
    let description: String

    /// Builds descriptors from live PluginManager data.
    static func fromPluginManager(_ pm: PluginManager) -> [PluginDescriptor] {
        pm.availablePlugins.map { meta in
            let plugin = pm.plugin(for: meta.identifier)
            let caps = capabilityStrings(plugin?.capabilities)
            return PluginDescriptor(
                identifier: meta.identifier,
                displayName: plugin?.displayName ?? meta.displayName,
                version: meta.version,
                iconName: iconForIdentifier(meta.identifier),
                requiresAPIKey: plugin?.requiresAPIKey ?? true,
                capabilities: caps,
                availableModels: plugin?.availableModels ?? [],
                description: descriptionForIdentifier(meta.identifier)
            )
        }
    }

    private static func iconForIdentifier(_ identifier: String) -> String {
        switch identifier {
        case "com.agenticplugins.plugin.claude-local": return "terminal"
        case "com.agenticplugins.plugin.claude-api": return "brain"
        case "com.agenticplugins.plugin.openai": return "cpu"
        case "com.agenticplugins.plugin.google": return "globe"
        case "com.agenticplugins.plugin.openai-compatible": return "slider.horizontal.3"
        default: return "puzzlepiece"
        }
    }

    private static func descriptionForIdentifier(_ identifier: String) -> String {
        switch identifier {
        case "com.agenticplugins.plugin.claude-local":
            return "Runs Claude via your local Claude Code CLI — no API key needed."
        case "com.agenticplugins.plugin.claude-api":
            return "Direct API access to Claude models via the Anthropic Messages API with streaming."
        case "com.agenticplugins.plugin.openai":
            return "OpenAI Chat Completions API — GPT-4 and ChatGPT models."
        case "com.agenticplugins.plugin.google":
            return "Google Generative Language API — Gemini models with a free tier available."
        case "com.agenticplugins.plugin.openai-compatible":
            return "Any server implementing the OpenAI Chat Completions API (/v1/chat/completions)."
        default:
            return "External plugin."
        }
    }

    private static func capabilityStrings(_ caps: PluginCapability?) -> [String] {
        guard let caps else { return [] }
        var result: [String] = []
        if caps.contains(.textCompletion) { result.append("Text") }
        if caps.contains(.streaming) { result.append("Streaming") }
        if caps.contains(.vision) { result.append("Vision") }
        if caps.contains(.functionCalling) { result.append("Functions") }
        return result
    }
}

// MARK: - PluginsSettingsPane

/// Settings pane showing installed plugins with a detail view for each.
/// Left: scrolling plugin list. Right: info card + plugin-supplied settings view.
final class PluginsSettingsPane: NSView, NSTableViewDataSource, NSTableViewDelegate, NSSplitViewDelegate {

    private let plugins: [PluginDescriptor]
    private let pluginManager: PluginManager
    private let splitView = NSSplitView()
    private let tableView = NSTableView()
    private let detailScroll = NSScrollView()
    private var selectedIndex: Int = 0

    init(pluginManager: PluginManager) {
        self.pluginManager = pluginManager
        self.plugins = PluginDescriptor.fromPluginManager(pluginManager)
        super.init(frame: .zero)
        setupViews()
        if !plugins.isEmpty {
            tableView.selectRowIndexes(IndexSet(integer: 0), byExtendingSelection: false)
            showDetail(for: plugins[0])
        }
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

    // MARK: - Layout

    private func setupViews() {
        // Sidebar list
        let column = NSTableColumn(identifier: NSUserInterfaceItemIdentifier("plugin"))
        column.resizingMask = .autoresizingMask
        tableView.addTableColumn(column)
        tableView.headerView = nil
        tableView.dataSource = self
        tableView.delegate = self
        tableView.rowHeight = 44
        tableView.style = .sourceList
        tableView.selectionHighlightStyle = .sourceList

        let sidebarScroll = NSScrollView()
        sidebarScroll.documentView = tableView
        sidebarScroll.hasVerticalScroller = true
        sidebarScroll.autohidesScrollers = true
        sidebarScroll.drawsBackground = false
        sidebarScroll.translatesAutoresizingMaskIntoConstraints = false

        // Detail scroll
        let detailClip = FlippedPluginClipView()
        detailScroll.contentView = detailClip
        detailScroll.hasVerticalScroller = true
        detailScroll.autohidesScrollers = true
        detailScroll.drawsBackground = false
        detailScroll.translatesAutoresizingMaskIntoConstraints = false

        // Split view
        splitView.isVertical = true
        splitView.dividerStyle = .thin
        splitView.delegate = self
        splitView.translatesAutoresizingMaskIntoConstraints = false
        splitView.addArrangedSubview(sidebarScroll)
        splitView.addArrangedSubview(detailScroll)
        splitView.setHoldingPriority(.required, forSubviewAt: 0)
        splitView.setHoldingPriority(.defaultLow, forSubviewAt: 1)

        addSubview(splitView)
        NSLayoutConstraint.activate([
            splitView.topAnchor.constraint(equalTo: topAnchor),
            splitView.leadingAnchor.constraint(equalTo: leadingAnchor),
            splitView.trailingAnchor.constraint(equalTo: trailingAnchor),
            splitView.bottomAnchor.constraint(equalTo: bottomAnchor),
        ])
    }

    override func layout() {
        super.layout()
        if splitView.subviews.first?.frame.width == 0 {
            splitView.setPosition(160, ofDividerAt: 0)
        }
    }

    // MARK: - Detail

    private func showDetail(for plugin: PluginDescriptor) {
        let livePlugin = pluginManager.plugin(for: plugin.identifier)
        let detail = PluginDetailView(plugin: plugin, settingsView: livePlugin?.settingsView())
        detail.translatesAutoresizingMaskIntoConstraints = false

        let wrapper = NSView()
        wrapper.translatesAutoresizingMaskIntoConstraints = false
        wrapper.addSubview(detail)

        let pad: CGFloat = 20
        NSLayoutConstraint.activate([
            detail.topAnchor.constraint(equalTo: wrapper.topAnchor, constant: pad),
            detail.leadingAnchor.constraint(equalTo: wrapper.leadingAnchor, constant: pad),
            detail.trailingAnchor.constraint(equalTo: wrapper.trailingAnchor, constant: -pad),
            detail.bottomAnchor.constraint(equalTo: wrapper.bottomAnchor, constant: -pad),
        ])

        detailScroll.documentView = wrapper

        if let clip = detailScroll.contentView as? NSClipView {
            wrapper.widthAnchor.constraint(equalTo: clip.widthAnchor).isActive = true
        }
    }

    // MARK: - NSTableViewDataSource

    func numberOfRows(in tableView: NSTableView) -> Int { plugins.count }

    // MARK: - NSTableViewDelegate

    func tableView(_ tableView: NSTableView, viewFor tableColumn: NSTableColumn?, row: Int) -> NSView? {
        let plugin = plugins[row]
        let id = NSUserInterfaceItemIdentifier("PluginCell")
        let cell = tableView.makeView(withIdentifier: id, owner: nil) as? NSTableCellView ?? makePluginCell(identifier: id)

        cell.imageView?.image = NSImage(systemSymbolName: plugin.iconName, accessibilityDescription: nil)
        cell.imageView?.contentTintColor = .secondaryLabelColor

        if let tf = cell.textField {
            tf.stringValue = plugin.displayName
            tf.font = .systemFont(ofSize: 13)
        }
        if let sub = cell.viewWithTag(99) as? NSTextField {
            sub.stringValue = plugin.version
        }

        return cell
    }

    private func makePluginCell(identifier: NSUserInterfaceItemIdentifier) -> NSTableCellView {
        let cell = NSTableCellView()
        cell.identifier = identifier

        let icon = NSImageView()
        icon.symbolConfiguration = .init(pointSize: 16, weight: .regular)
        icon.translatesAutoresizingMaskIntoConstraints = false

        let name = NSTextField(labelWithString: "")
        name.font = .systemFont(ofSize: 13)
        name.lineBreakMode = .byTruncatingTail
        name.translatesAutoresizingMaskIntoConstraints = false

        let version = NSTextField(labelWithString: "")
        version.font = .systemFont(ofSize: 10)
        version.textColor = .tertiaryLabelColor
        version.tag = 99
        version.translatesAutoresizingMaskIntoConstraints = false

        cell.addSubview(icon)
        cell.addSubview(name)
        cell.addSubview(version)
        cell.imageView = icon
        cell.textField = name

        NSLayoutConstraint.activate([
            icon.leadingAnchor.constraint(equalTo: cell.leadingAnchor, constant: 6),
            icon.centerYAnchor.constraint(equalTo: cell.centerYAnchor),
            icon.widthAnchor.constraint(equalToConstant: 20),
            icon.heightAnchor.constraint(equalToConstant: 20),

            name.leadingAnchor.constraint(equalTo: icon.trailingAnchor, constant: 8),
            name.trailingAnchor.constraint(equalTo: cell.trailingAnchor, constant: -4),
            name.bottomAnchor.constraint(equalTo: cell.centerYAnchor, constant: 1),

            version.leadingAnchor.constraint(equalTo: name.leadingAnchor),
            version.topAnchor.constraint(equalTo: cell.centerYAnchor, constant: 3),
        ])

        return cell
    }

    func tableView(_ tableView: NSTableView, heightOfRow row: Int) -> CGFloat { 44 }

    func tableViewSelectionDidChange(_ notification: Notification) {
        let row = tableView.selectedRow
        guard row >= 0, row < plugins.count else { return }
        selectedIndex = row
        showDetail(for: plugins[row])
    }

    // MARK: - NSSplitViewDelegate

    func splitView(_ splitView: NSSplitView, canCollapseSubview subview: NSView) -> Bool { false }

    func splitView(_ splitView: NSSplitView, constrainMinCoordinate proposedMin: CGFloat, ofSubviewAt dividerIndex: Int) -> CGFloat { 140 }

    func splitView(_ splitView: NSSplitView, constrainMaxCoordinate proposedMax: CGFloat, ofSubviewAt dividerIndex: Int) -> CGFloat { 220 }
}

// MARK: - PluginDetailView

private final class PluginDetailView: NSView {

    init(plugin: PluginDescriptor, settingsView: NSView? = nil) {
        super.init(frame: .zero)

        let stack = NSStackView()
        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = 16
        stack.translatesAutoresizingMaskIntoConstraints = false

        // Header — icon + name
        let iconView = NSImageView()
        iconView.image = NSImage(systemSymbolName: plugin.iconName, accessibilityDescription: nil)
        iconView.symbolConfiguration = .init(pointSize: 32, weight: .regular)
        iconView.contentTintColor = .secondaryLabelColor
        iconView.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            iconView.widthAnchor.constraint(equalToConstant: 44),
            iconView.heightAnchor.constraint(equalToConstant: 44),
        ])

        let nameLabel = NSTextField(labelWithString: plugin.displayName)
        nameLabel.font = .systemFont(ofSize: 18, weight: .semibold)
        nameLabel.lineBreakMode = .byTruncatingTail

        let versionLabel = NSTextField(labelWithString: "v\(plugin.version)")
        versionLabel.font = .systemFont(ofSize: 12)
        versionLabel.textColor = .secondaryLabelColor

        let identifierLabel = NSTextField(labelWithString: plugin.identifier)
        identifierLabel.font = .monospacedSystemFont(ofSize: 11, weight: .regular)
        identifierLabel.textColor = .tertiaryLabelColor

        let nameStack = NSStackView(views: [nameLabel, versionLabel, identifierLabel])
        nameStack.orientation = .vertical
        nameStack.alignment = .leading
        nameStack.spacing = 2

        let headerRow = NSStackView(views: [iconView, nameStack])
        headerRow.orientation = .horizontal
        headerRow.spacing = 12
        headerRow.alignment = .centerY
        stack.addArrangedSubview(headerRow)

        // Separator
        stack.addArrangedSubview(makeSeparator())

        // Description
        let descLabel = NSTextField(wrappingLabelWithString: plugin.description)
        descLabel.font = .systemFont(ofSize: 13)
        descLabel.textColor = .secondaryLabelColor
        stack.addArrangedSubview(descLabel)

        // Capabilities
        if !plugin.capabilities.isEmpty {
            stack.addArrangedSubview(makeSectionHeader("Capabilities"))
            let capRow = makeCapabilityBadges(plugin.capabilities)
            stack.addArrangedSubview(capRow)
        }

        // Models
        if !plugin.availableModels.isEmpty {
            stack.addArrangedSubview(makeSectionHeader("Available Models"))
            for model in plugin.availableModels {
                let label = NSTextField(labelWithString: model)
                label.font = .monospacedSystemFont(ofSize: 12, weight: .regular)
                label.textColor = .labelColor
                stack.addArrangedSubview(label)
            }
        }

        // API key requirement
        stack.addArrangedSubview(makeSeparator())
        let authLabel = NSTextField(wrappingLabelWithString: plugin.requiresAPIKey
            ? "This plugin requires an API key. Configure credentials in Settings \u{2192} AI."
            : "This plugin uses your local Claude Code installation \u{2014} no API key required."
        )
        authLabel.font = .systemFont(ofSize: 12)
        authLabel.textColor = .secondaryLabelColor
        stack.addArrangedSubview(authLabel)

        // Plugin-provided settings view
        if let settingsView {
            stack.addArrangedSubview(makeSeparator())
            stack.addArrangedSubview(makeSectionHeader("Plugin Settings"))
            settingsView.translatesAutoresizingMaskIntoConstraints = false
            stack.addArrangedSubview(settingsView)
        }

        addSubview(stack)
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: topAnchor),
            stack.leadingAnchor.constraint(equalTo: leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: trailingAnchor),
            stack.bottomAnchor.constraint(equalTo: bottomAnchor),
            descLabel.widthAnchor.constraint(equalTo: stack.widthAnchor),
            authLabel.widthAnchor.constraint(equalTo: stack.widthAnchor),
            headerRow.widthAnchor.constraint(equalTo: stack.widthAnchor),
        ])
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

    private func makeSectionHeader(_ title: String) -> NSTextField {
        let label = NSTextField(labelWithString: title)
        label.font = .systemFont(ofSize: 12, weight: .semibold)
        label.textColor = .secondaryLabelColor
        return label
    }

    private func makeSeparator() -> NSBox {
        let sep = NSBox()
        sep.boxType = .separator
        sep.translatesAutoresizingMaskIntoConstraints = false
        return sep
    }

    private func makeCapabilityBadges(_ capabilities: [String]) -> NSView {
        let row = NSStackView()
        row.orientation = .horizontal
        row.spacing = 6

        for cap in capabilities {
            let badge = NSTextField(labelWithString: cap)
            badge.font = .systemFont(ofSize: 11, weight: .medium)
            badge.textColor = .controlAccentColor
            badge.wantsLayer = true
            badge.layer?.cornerRadius = 4
            badge.layer?.backgroundColor = NSColor.controlAccentColor.withAlphaComponent(0.10).cgColor
            badge.setContentHuggingPriority(.required, for: .horizontal)

            let container = NSView()
            container.wantsLayer = true
            container.layer?.cornerRadius = 4
            container.translatesAutoresizingMaskIntoConstraints = false
            badge.translatesAutoresizingMaskIntoConstraints = false
            container.addSubview(badge)
            NSLayoutConstraint.activate([
                badge.topAnchor.constraint(equalTo: container.topAnchor, constant: 2),
                badge.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: 6),
                badge.trailingAnchor.constraint(equalTo: container.trailingAnchor, constant: -6),
                badge.bottomAnchor.constraint(equalTo: container.bottomAnchor, constant: -2),
            ])
            row.addArrangedSubview(container)
        }

        return row
    }
}

// MARK: - Flipped Clip View

private final class FlippedPluginClipView: NSClipView {
    override var isFlipped: Bool { true }
}
