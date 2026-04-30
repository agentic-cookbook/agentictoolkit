import AppKit
import Combine

/// A floating panel view that shows all discoverable windows grouped by app.
/// Opens immediately with a spinner while window enumeration runs asynchronously.
public final class WindowDiscoveryView: NSView {
    private let viewModel: WindowDiscoveryViewModel
    private var cancellables = Set<AnyCancellable>()

    private let headerView = NSView()
    private let contentContainer = NSView()

    public init(viewModel: WindowDiscoveryViewModel) {
        self.viewModel = viewModel
        super.init(frame: NSRect(x: 0, y: 0, width: 380, height: 420))
        setupViews()
        bindViewModel()
        viewModel.discoverWindows()
    }

    @available(*, unavailable)
    public required init?(coder: NSCoder) { fatalError() }

    private func setupViews() {
        // Header
        let titleLabel = NSTextField(labelWithString: "Select Window")
        titleLabel.font = .systemFont(ofSize: 13, weight: .semibold)
        titleLabel.translatesAutoresizingMaskIntoConstraints = false

        let projectBadge = NSTextField(labelWithString: viewModel.session.projectName)
        projectBadge.font = .systemFont(ofSize: 11)
        projectBadge.textColor = .secondaryLabelColor
        projectBadge.wantsLayer = true
        projectBadge.layer?.backgroundColor = NSColor.white.withAlphaComponent(0.06).cgColor
        projectBadge.layer?.cornerRadius = 4
        projectBadge.translatesAutoresizingMaskIntoConstraints = false

        headerView.translatesAutoresizingMaskIntoConstraints = false
        headerView.addSubview(titleLabel)
        headerView.addSubview(projectBadge)
        NSLayoutConstraint.activate([
            headerView.heightAnchor.constraint(equalToConstant: 36),
            titleLabel.leadingAnchor.constraint(equalTo: headerView.leadingAnchor, constant: 12),
            titleLabel.centerYAnchor.constraint(equalTo: headerView.centerYAnchor),
            projectBadge.trailingAnchor.constraint(equalTo: headerView.trailingAnchor, constant: -12),
            projectBadge.centerYAnchor.constraint(equalTo: headerView.centerYAnchor)
        ])

        let divider = NSBox()
        divider.boxType = .separator
        divider.translatesAutoresizingMaskIntoConstraints = false

        contentContainer.translatesAutoresizingMaskIntoConstraints = false

        addSubview(headerView)
        addSubview(divider)
        addSubview(contentContainer)

        NSLayoutConstraint.activate([
            headerView.topAnchor.constraint(equalTo: topAnchor),
            headerView.leadingAnchor.constraint(equalTo: leadingAnchor),
            headerView.trailingAnchor.constraint(equalTo: trailingAnchor),

            divider.topAnchor.constraint(equalTo: headerView.bottomAnchor),
            divider.leadingAnchor.constraint(equalTo: leadingAnchor),
            divider.trailingAnchor.constraint(equalTo: trailingAnchor),

            contentContainer.topAnchor.constraint(equalTo: divider.bottomAnchor),
            contentContainer.leadingAnchor.constraint(equalTo: leadingAnchor),
            contentContainer.trailingAnchor.constraint(equalTo: trailingAnchor),
            contentContainer.bottomAnchor.constraint(equalTo: bottomAnchor)
        ])
    }

    private func bindViewModel() {
        viewModel.$isLoading
            .combineLatest(viewModel.$accessibilityDenied, viewModel.$apps)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] isLoading, denied, apps in
                self?.updateContent(isLoading: isLoading, denied: denied, apps: apps)
            }
            .store(in: &cancellables)
    }

    private func updateContent(isLoading: Bool, denied: Bool, apps: [DiscoveredApp]) {
        contentContainer.subviews.forEach { $0.removeFromSuperview() }

        if isLoading {
            showCenteredState(icon: nil, showSpinner: true, title: "Discovering windows\u{2026}")
        } else if denied {
            showAccessibilityDenied()
        } else if apps.isEmpty {
            showCenteredState(
                icon: NSImage(systemSymbolName: "macwindow.badge.plus", accessibilityDescription: nil),
                showSpinner: false,
                title: "No windows found"
            )
        } else {
            showWindowList(apps: apps)
        }
    }

    private func showCenteredState(icon: NSImage?, showSpinner: Bool, title: String) {
        let stack = NSStackView()
        stack.orientation = .vertical
        stack.spacing = 12
        stack.alignment = .centerX
        stack.translatesAutoresizingMaskIntoConstraints = false

        if showSpinner {
            let spinner = NSProgressIndicator()
            spinner.style = .spinning
            spinner.controlSize = .regular
            spinner.startAnimation(nil)
            stack.addArrangedSubview(spinner)
        }

        if let icon {
            let imageView = NSImageView()
            imageView.image = icon
            imageView.symbolConfiguration = .init(pointSize: 24, weight: .regular)
            imageView.contentTintColor = .secondaryLabelColor
            stack.addArrangedSubview(imageView)
        }

        let label = NSTextField(labelWithString: title)
        label.font = .systemFont(ofSize: 11)
        label.textColor = .secondaryLabelColor
        stack.addArrangedSubview(label)

        contentContainer.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.centerXAnchor.constraint(equalTo: contentContainer.centerXAnchor),
            stack.centerYAnchor.constraint(equalTo: contentContainer.centerYAnchor)
        ])
    }

    private func showAccessibilityDenied() {
        let stack = NSStackView()
        stack.orientation = .vertical
        stack.spacing = 12
        stack.alignment = .centerX
        stack.translatesAutoresizingMaskIntoConstraints = false

        let icon = NSImageView()
        icon.image = NSImage(systemSymbolName: "lock.shield", accessibilityDescription: nil)
        icon.symbolConfiguration = .init(pointSize: 24, weight: .regular)
        icon.contentTintColor = .systemOrange

        let title = NSTextField(labelWithString: "Accessibility Access Required")
        title.font = .systemFont(ofSize: 12, weight: .medium)

        let desc = NSTextField(wrappingLabelWithString: "Grant Whippet Accessibility access to discover and activate windows.")
        desc.font = .systemFont(ofSize: 11)
        desc.textColor = .secondaryLabelColor
        desc.alignment = .center
        desc.translatesAutoresizingMaskIntoConstraints = false
        desc.widthAnchor.constraint(lessThanOrEqualToConstant: 260).isActive = true

        let button = NSButton(title: "Open System Settings", target: self, action: #selector(openAccessibilitySettings))
        button.bezelStyle = .rounded
        button.controlSize = .small

        stack.addArrangedSubview(icon)
        stack.addArrangedSubview(title)
        stack.addArrangedSubview(desc)
        stack.addArrangedSubview(button)

        contentContainer.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.centerXAnchor.constraint(equalTo: contentContainer.centerXAnchor),
            stack.centerYAnchor.constraint(equalTo: contentContainer.centerYAnchor)
        ])
    }

    @objc private func openAccessibilitySettings() {
        viewModel.openAccessibilitySettings()
    }

    private func showWindowList(apps: [DiscoveredApp]) {
        let scrollView = NSScrollView()
        scrollView.hasVerticalScroller = true
        scrollView.drawsBackground = false
        scrollView.translatesAutoresizingMaskIntoConstraints = false

        let stack = NSStackView()
        stack.orientation = .vertical
        stack.spacing = 4
        stack.edgeInsets = NSEdgeInsets(top: 8, left: 8, bottom: 8, right: 8)
        stack.translatesAutoresizingMaskIntoConstraints = false

        for app in apps {
            let section = DiscoveredAppSectionView(
                app: app,
                onWindowSelected: { [weak self] window in
                    self?.viewModel.activateWindow(window)
                }
            )
            stack.addArrangedSubview(section)
            section.widthAnchor.constraint(equalTo: stack.widthAnchor, constant: -16).isActive = true
        }

        scrollView.documentView = stack
        contentContainer.addSubview(scrollView)
        NSLayoutConstraint.activate([
            scrollView.topAnchor.constraint(equalTo: contentContainer.topAnchor),
            scrollView.leadingAnchor.constraint(equalTo: contentContainer.leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: contentContainer.trailingAnchor),
            scrollView.bottomAnchor.constraint(equalTo: contentContainer.bottomAnchor),
            stack.widthAnchor.constraint(equalTo: scrollView.widthAnchor)
        ])
    }
}

// MARK: - Discovered App Section

public final class DiscoveredAppSectionView: NSView {
    private let app: DiscoveredApp
    private let onWindowSelected: (DiscoveredWindow) -> Void
    private var isExpanded = true
    private let windowsStack = NSStackView()

    public init(app: DiscoveredApp, onWindowSelected: @escaping (DiscoveredWindow) -> Void) {
        self.app = app
        self.onWindowSelected = onWindowSelected
        super.init(frame: .zero)
        wantsLayer = true
        layer?.cornerRadius = 6
        layer?.backgroundColor = (app.hasMatch
            ? NSColor.controlAccentColor.withAlphaComponent(0.06)
            : NSColor.white.withAlphaComponent(0.03)).cgColor
        if app.hasMatch {
            layer?.borderColor = NSColor.controlAccentColor.withAlphaComponent(0.2).cgColor
            layer?.borderWidth = 0.5
        }
        setupViews()
    }

    @available(*, unavailable)
    public required init?(coder: NSCoder) { fatalError() }

    private func setupViews() {
        let outerStack = NSStackView()
        outerStack.orientation = .vertical
        outerStack.spacing = 0
        outerStack.translatesAutoresizingMaskIntoConstraints = false

        // App header button
        let headerButton = NSButton()
        headerButton.isBordered = false
        headerButton.target = self
        headerButton.action = #selector(toggleExpanded)
        headerButton.translatesAutoresizingMaskIntoConstraints = false

        let headerStack = NSStackView()
        headerStack.orientation = .horizontal
        headerStack.spacing = 6
        headerStack.edgeInsets = NSEdgeInsets(top: 5, left: 8, bottom: 5, right: 8)
        headerStack.translatesAutoresizingMaskIntoConstraints = false

        if let appIcon = app.icon {
            let iconView = NSImageView(image: appIcon)
            iconView.translatesAutoresizingMaskIntoConstraints = false
            NSLayoutConstraint.activate([
                iconView.widthAnchor.constraint(equalToConstant: 16),
                iconView.heightAnchor.constraint(equalToConstant: 16)
            ])
            headerStack.addArrangedSubview(iconView)
        }

        let nameLabel = NSTextField(labelWithString: app.name)
        nameLabel.font = .systemFont(ofSize: 11, weight: .semibold)
        headerStack.addArrangedSubview(nameLabel)

        let countLabel = NSTextField(labelWithString: "(\(app.windows.count))")
        countLabel.font = .systemFont(ofSize: 10)
        countLabel.textColor = .tertiaryLabelColor
        headerStack.addArrangedSubview(countLabel)

        let spacer = NSView()
        spacer.setContentHuggingPriority(.defaultLow, for: .horizontal)
        headerStack.addArrangedSubview(spacer)

        let chevron = NSImageView()
        chevron.image = NSImage(systemSymbolName: "chevron.down", accessibilityDescription: nil)
        chevron.symbolConfiguration = .init(pointSize: 9, weight: .regular)
        chevron.contentTintColor = .tertiaryLabelColor
        headerStack.addArrangedSubview(chevron)

        // Use a clickable container instead of wrapping in a button
        let headerContainer = ClickableView { [weak self] in self?.toggleExpanded() }
        headerContainer.translatesAutoresizingMaskIntoConstraints = false
        headerContainer.addSubview(headerStack)
        NSLayoutConstraint.activate([
            headerStack.topAnchor.constraint(equalTo: headerContainer.topAnchor),
            headerStack.leadingAnchor.constraint(equalTo: headerContainer.leadingAnchor),
            headerStack.trailingAnchor.constraint(equalTo: headerContainer.trailingAnchor),
            headerStack.bottomAnchor.constraint(equalTo: headerContainer.bottomAnchor)
        ])
        outerStack.addArrangedSubview(headerContainer)

        // Windows
        windowsStack.orientation = .vertical
        windowsStack.spacing = 0
        windowsStack.translatesAutoresizingMaskIntoConstraints = false

        for window in app.windows {
            let row = DiscoveredWindowRowView(window: window) { [weak self] w in
                self?.onWindowSelected(w)
            }
            windowsStack.addArrangedSubview(row)
        }
        outerStack.addArrangedSubview(windowsStack)

        addSubview(outerStack)
        NSLayoutConstraint.activate([
            outerStack.topAnchor.constraint(equalTo: topAnchor),
            outerStack.leadingAnchor.constraint(equalTo: leadingAnchor),
            outerStack.trailingAnchor.constraint(equalTo: trailingAnchor),
            outerStack.bottomAnchor.constraint(equalTo: bottomAnchor)
        ])
    }

    @objc private func toggleExpanded() {
        isExpanded.toggle()
        windowsStack.isHidden = !isExpanded
    }
}

// MARK: - Discovered Window Row

public final class DiscoveredWindowRowView: NSView {
    private let discoveredWindow: DiscoveredWindow
    private let onSelected: (DiscoveredWindow) -> Void
    private var trackingArea: NSTrackingArea?
    private var isHovered = false

    public init(window: DiscoveredWindow, onSelected: @escaping (DiscoveredWindow) -> Void) {
        self.discoveredWindow = window
        self.onSelected = onSelected
        super.init(frame: .zero)
        setupViews()
    }

    @available(*, unavailable)
    public required init?(coder: NSCoder) { fatalError() }

    private func setupViews() {
        let stack = NSStackView()
        stack.orientation = .horizontal
        stack.spacing = 6
        stack.edgeInsets = NSEdgeInsets(top: 4, left: 24, bottom: 4, right: 8)
        stack.translatesAutoresizingMaskIntoConstraints = false

        let icon = NSImageView()
        icon.image = NSImage(systemSymbolName: "macwindow", accessibilityDescription: nil)
        icon.symbolConfiguration = .init(pointSize: 10, weight: .regular)
        icon.contentTintColor = discoveredWindow.isMatch ? .controlAccentColor : .secondaryLabelColor
        icon.translatesAutoresizingMaskIntoConstraints = false
        icon.widthAnchor.constraint(equalToConstant: 16).isActive = true

        let titleLabel = NSTextField(labelWithString: discoveredWindow.title)
        titleLabel.font = .systemFont(ofSize: 11, weight: discoveredWindow.isMatch ? .medium : .regular)
        titleLabel.textColor = discoveredWindow.isMatch ? .labelColor : .secondaryLabelColor
        titleLabel.lineBreakMode = .byTruncatingTail
        titleLabel.maximumNumberOfLines = 1
        titleLabel.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)

        stack.addArrangedSubview(icon)
        stack.addArrangedSubview(titleLabel)

        let spacer = NSView()
        spacer.setContentHuggingPriority(.defaultLow, for: .horizontal)
        stack.addArrangedSubview(spacer)

        if discoveredWindow.isMatch {
            let badge = NSTextField(labelWithString: "match")
            badge.font = .systemFont(ofSize: 9)
            badge.textColor = .controlAccentColor
            badge.wantsLayer = true
            badge.layer?.backgroundColor = NSColor.controlAccentColor.withAlphaComponent(0.1).cgColor
            badge.layer?.cornerRadius = 3
            stack.addArrangedSubview(badge)
        }

        addSubview(stack)
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: topAnchor),
            stack.leadingAnchor.constraint(equalTo: leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: trailingAnchor),
            stack.bottomAnchor.constraint(equalTo: bottomAnchor)
        ])
    }

    public override func updateTrackingAreas() {
        super.updateTrackingAreas()
        if let existing = trackingArea { removeTrackingArea(existing) }
        trackingArea = NSTrackingArea(
            rect: bounds,
            options: [.mouseEnteredAndExited, .activeInKeyWindow],
            owner: self, userInfo: nil
        )
        addTrackingArea(trackingArea!)
    }

    public override func mouseEntered(with event: NSEvent) {
        isHovered = true
        wantsLayer = true
        layer?.backgroundColor = NSColor.white.withAlphaComponent(0.06).cgColor
    }

    public override func mouseExited(with event: NSEvent) {
        isHovered = false
        layer?.backgroundColor = NSColor.clear.cgColor
    }

    public override func mouseUp(with event: NSEvent) {
        let location = convert(event.locationInWindow, from: nil)
        if bounds.contains(location) {
            onSelected(discoveredWindow)
        }
    }
}

// MARK: - Clickable View Helper

public final class ClickableView: NSView {
    private let onClick: () -> Void

    public init(onClick: @escaping () -> Void) {
        self.onClick = onClick
        super.init(frame: .zero)
    }

    @available(*, unavailable)
    public required init?(coder: NSCoder) { fatalError() }

    public override func mouseUp(with event: NSEvent) {
        let location = convert(event.locationInWindow, from: nil)
        if bounds.contains(location) {
            onClick()
        }
    }
}
