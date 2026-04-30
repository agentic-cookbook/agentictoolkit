import AppKit
import Combine

extension SessionWatcher {
    /// The main AppKit view displayed inside the floating session palette.
    public final class SessionListView: NSView {
        private let viewModel: SessionListViewModel
        private var cancellables = Set<AnyCancellable>()

        private let scrollView = NSScrollView()
        private let stackView = NSStackView()
        private let emptyStateView = SessionWatcherEmptyStateView()
        private var errorBanner: SessionWatcherErrorBanner?

        public init(viewModel: SessionListViewModel) {
            self.viewModel = viewModel
            super.init(frame: .zero)
            setupViews()
            bindViewModel()
        }

        @available(*, unavailable)
        public required init?(coder: NSCoder) { fatalError() }

        /// Notification posted when content changes and the panel should resize.
        public static let contentSizeDidChangeNotification = Notification.Name("SessionContentViewContentSizeDidChange")

        public override var intrinsicContentSize: NSSize {
            let contentHeight = stackView.fittingSize.height
            return NSSize(width: NSView.noIntrinsicMetric, height: contentHeight)
        }

        private func setupViews() {
            // Stack view for session groups
            stackView.orientation = .vertical
            stackView.spacing = 6
            stackView.edgeInsets = NSEdgeInsets(top: 6, left: 8, bottom: 6, right: 8)
            stackView.translatesAutoresizingMaskIntoConstraints = false

            // Scroll view wrapping the stack
            scrollView.documentView = stackView
            scrollView.hasVerticalScroller = true
            scrollView.scrollerStyle = .overlay
            scrollView.autohidesScrollers = true
            scrollView.hasHorizontalScroller = false
            scrollView.drawsBackground = false
            scrollView.automaticallyAdjustsContentInsets = false
            scrollView.contentInsets = NSEdgeInsets(top: 0, left: 0, bottom: 0, right: 0)
            scrollView.translatesAutoresizingMaskIntoConstraints = false

            // Empty state
            emptyStateView.translatesAutoresizingMaskIntoConstraints = false
            emptyStateView.isHidden = true

            addSubview(scrollView)
            addSubview(emptyStateView)

            NSLayoutConstraint.activate([
                scrollView.topAnchor.constraint(equalTo: topAnchor),
                scrollView.leadingAnchor.constraint(equalTo: leadingAnchor),
                scrollView.trailingAnchor.constraint(equalTo: trailingAnchor),
                scrollView.bottomAnchor.constraint(equalTo: bottomAnchor),

                stackView.widthAnchor.constraint(equalTo: scrollView.widthAnchor),

                emptyStateView.topAnchor.constraint(equalTo: topAnchor),
                emptyStateView.leadingAnchor.constraint(equalTo: leadingAnchor),
                emptyStateView.trailingAnchor.constraint(equalTo: trailingAnchor),
                emptyStateView.bottomAnchor.constraint(equalTo: bottomAnchor)
            ])
        }

        private func bindViewModel() {
            viewModel.$groups
                .combineLatest(viewModel.$isEmpty)
                .receive(on: DispatchQueue.main)
                .sink { [weak self] groups, isEmpty in
                    self?.updateContent(groups: groups, isEmpty: isEmpty)
                }
                .store(in: &cancellables)

            viewModel.$lastActionError
                .combineLatest(viewModel.$lastPermissionPane)
                .receive(on: DispatchQueue.main)
                .sink { [weak self] error, pane in
                    self?.updateErrorBanner(error: error, pane: pane)
                }
                .store(in: &cancellables)
        }

        private func updateContent(groups: [SessionWatcherGroup], isEmpty: Bool) {
            stackView.arrangedSubviews.forEach { $0.removeFromSuperview() }

            if isEmpty {
                scrollView.isHidden = true
                emptyStateView.isHidden = false
            } else {
                scrollView.isHidden = false
                emptyStateView.isHidden = true

                for group in groups {
                    let groupView = SessionWatcherGroupCardView(
                        group: group,
                        onSessionClick: { [weak self] session in self?.viewModel.handleSessionClick(session) },
                        summarizingSessionIds: viewModel.summarizingSessionIds,
                        onSummarize: { [weak self] session in self?.viewModel.summarizeSession(session) },
                        frontmostSessionId: viewModel.frontmostSessionId
                    )
                    stackView.addArrangedSubview(groupView)
                    groupView.widthAnchor.constraint(equalTo: stackView.widthAnchor, constant: -16).isActive = true
                }
            }
            invalidateIntrinsicContentSize()

            // Post after layout so the panel controller can resize
            DispatchQueue.main.async {
                self.needsLayout = true
                self.layoutSubtreeIfNeeded()
                NotificationCenter.default.post(
                    name: Self.contentSizeDidChangeNotification,
                    object: self
                )
            }
        }

        private func updateErrorBanner(error: String?, pane: SessionWatcherPermissionPane?) {
            errorBanner?.removeFromSuperview()
            errorBanner = nil

            guard let error else { return }

            let banner = SessionWatcherErrorBanner(
                message: error,
                isPermissionError: pane != nil,
                onOpenSettings: { [weak self] in self?.viewModel.openPermissionSettings() }
            )
            banner.translatesAutoresizingMaskIntoConstraints = false
            addSubview(banner)

            NSLayoutConstraint.activate([
                banner.leadingAnchor.constraint(equalTo: leadingAnchor),
                banner.trailingAnchor.constraint(equalTo: trailingAnchor),
                banner.bottomAnchor.constraint(equalTo: bottomAnchor)
            ])
            errorBanner = banner
        }
    }

    // MARK: - Empty State View

    public final class SessionWatcherEmptyStateView: NSView {
        public override init(frame: NSRect) {
            super.init(frame: frame)
            setupViews()
        }

        @available(*, unavailable)
        public required init?(coder: NSCoder) { fatalError() }

        private func setupViews() {
            let imageView = NSImageView()
            imageView.image = NSImage(systemSymbolName: "dog.fill", accessibilityDescription: nil)
            imageView.symbolConfiguration = .init(pointSize: 24, weight: .regular)
            imageView.contentTintColor = .secondaryLabelColor
            imageView.translatesAutoresizingMaskIntoConstraints = false

            let label = NSTextField(labelWithString: "No Active Sessions")
            label.font = .systemFont(ofSize: 12, weight: .medium)
            label.textColor = .secondaryLabelColor
            label.alignment = .center
            label.translatesAutoresizingMaskIntoConstraints = false

            let stack = NSStackView(views: [imageView, label])
            stack.orientation = .vertical
            stack.spacing = 8
            stack.alignment = .centerX
            stack.translatesAutoresizingMaskIntoConstraints = false

            addSubview(stack)
            NSLayoutConstraint.activate([
                stack.centerXAnchor.constraint(equalTo: centerXAnchor),
                stack.centerYAnchor.constraint(equalTo: centerYAnchor)
            ])
        }
    }

    // MARK: - SessionWatcherSession Group Card View

    public final class SessionWatcherGroupCardView: NSView {
        private let group: SessionWatcherGroup
        private let onSessionClick: ((SessionWatcherSession) -> Void)?
        private let summarizingSessionIds: Set<String>
        private let onSummarize: ((SessionWatcherSession) -> Void)?
        private let frontmostSessionId: String?

        public init(
            group: SessionWatcherGroup,
            onSessionClick: ((SessionWatcherSession) -> Void)?,
            summarizingSessionIds: Set<String>,
            onSummarize: ((SessionWatcherSession) -> Void)?,
            frontmostSessionId: String?
        ) {
            self.group = group
            self.onSessionClick = onSessionClick
            self.summarizingSessionIds = summarizingSessionIds
            self.onSummarize = onSummarize
            self.frontmostSessionId = frontmostSessionId
            super.init(frame: .zero)
            wantsLayer = true
            layer?.cornerRadius = 8
            layer?.backgroundColor = NSColor.white.withAlphaComponent(0.05).cgColor
            layer?.borderColor = NSColor.white.withAlphaComponent(0.08).cgColor
            layer?.borderWidth = 0.5
            setupViews()
        }

        @available(*, unavailable)
        public required init?(coder: NSCoder) { fatalError() }

        private func setupViews() {
            let stack = NSStackView()
            stack.orientation = .vertical
            stack.spacing = 0
            stack.translatesAutoresizingMaskIntoConstraints = false

            // Header
            stack.addArrangedSubview(makeSessionHeader())
            stack.addArrangedSubview(makeDivider())

            // Sessions
            if group.sessions.isEmpty {
                let noneLabel = NSTextField(labelWithString: "None")
                noneLabel.font = .systemFont(ofSize: 11)
                noneLabel.textColor = .tertiaryLabelColor
                let wrapper = NSView()
                wrapper.translatesAutoresizingMaskIntoConstraints = false
                noneLabel.translatesAutoresizingMaskIntoConstraints = false
                wrapper.addSubview(noneLabel)
                NSLayoutConstraint.activate([
                    noneLabel.leadingAnchor.constraint(equalTo: wrapper.leadingAnchor, constant: 10),
                    noneLabel.topAnchor.constraint(equalTo: wrapper.topAnchor, constant: 6),
                    noneLabel.bottomAnchor.constraint(equalTo: wrapper.bottomAnchor, constant: -6)
                ])
                stack.addArrangedSubview(wrapper)
            } else {
                for session in group.sessions {
                    let row = SessionWatcherRowAppKitView(
                        session: session,
                        onTap: onSessionClick,
                        isSummarizing: summarizingSessionIds.contains(session.sessionId),
                        onSummarize: onSummarize,
                        isFrontmost: session.sessionId == frontmostSessionId
                    )
                    row.translatesAutoresizingMaskIntoConstraints = false
                    stack.addArrangedSubview(row)
                    row.leadingAnchor.constraint(equalTo: stack.leadingAnchor, constant: 8).isActive = true
                    row.trailingAnchor.constraint(equalTo: stack.trailingAnchor, constant: -8).isActive = true
                }
            }

            addSubview(stack)
            NSLayoutConstraint.activate([
                stack.topAnchor.constraint(equalTo: topAnchor),
                stack.leadingAnchor.constraint(equalTo: leadingAnchor),
                stack.trailingAnchor.constraint(equalTo: trailingAnchor),
                stack.bottomAnchor.constraint(equalTo: bottomAnchor)
            ])
        }

        private func makeSessionHeader() -> NSView {
            let container = NSView()
            container.translatesAutoresizingMaskIntoConstraints = false

            let appName = terminalAppName(for: group.termProgram)

            // App icon
            var leadingAnchorView: NSView = container
            var leadingConstant: CGFloat = 10

            if let icon = terminalAppIcon(for: group.termProgram) {
                let iconView = NSImageView(image: icon)
                iconView.toolTip = appName
                iconView.imageScaling = .scaleProportionallyUpOrDown
                iconView.setContentHuggingPriority(.defaultLow, for: .horizontal)
                iconView.setContentHuggingPriority(.defaultLow, for: .vertical)
                iconView.translatesAutoresizingMaskIntoConstraints = false
                container.addSubview(iconView)
                let iconSize: CGFloat = 64
                NSLayoutConstraint.activate([
                    iconView.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: 10),
                    iconView.centerYAnchor.constraint(equalTo: container.centerYAnchor),
                    iconView.widthAnchor.constraint(equalToConstant: iconSize),
                    iconView.heightAnchor.constraint(equalToConstant: iconSize)
                ])
                leadingAnchorView = iconView
                leadingConstant = 6
            }

            let titleLabel = NSTextField(labelWithString: appName)
            titleLabel.font = .systemFont(ofSize: 13, weight: .semibold)
            titleLabel.textColor = .labelColor
            titleLabel.translatesAutoresizingMaskIntoConstraints = false

            let suffix = group.sessions.count == 1 ? "" : "s"
            let countLabel = NSTextField(labelWithString: "\(group.sessions.count) session\(suffix)")
            countLabel.font = .systemFont(ofSize: 10)
            countLabel.textColor = .tertiaryLabelColor
            countLabel.translatesAutoresizingMaskIntoConstraints = false

            container.addSubview(titleLabel)
            container.addSubview(countLabel)

            let titleLeading = leadingAnchorView === container
            ? titleLabel.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: leadingConstant)
            : titleLabel.leadingAnchor.constraint(equalTo: leadingAnchorView.trailingAnchor, constant: leadingConstant)

            NSLayoutConstraint.activate([
                container.heightAnchor.constraint(greaterThanOrEqualToConstant: 72),
                titleLeading,
                titleLabel.centerYAnchor.constraint(equalTo: container.centerYAnchor),
                countLabel.trailingAnchor.constraint(equalTo: container.trailingAnchor, constant: -10),
                countLabel.centerYAnchor.constraint(equalTo: container.centerYAnchor),
                countLabel.leadingAnchor.constraint(greaterThanOrEqualTo: titleLabel.trailingAnchor, constant: 5)
            ])

            return container
        }

        private func makeDivider() -> NSView {
            let divider = NSBox()
            divider.boxType = .separator
            divider.alphaValue = 0.15
            divider.translatesAutoresizingMaskIntoConstraints = false
            return divider
        }
    }

    // MARK: - SessionWatcherSession Row View

    public final class SessionWatcherRowAppKitView: NSView {
        private let session: SessionWatcherSession
        private let onTap: ((SessionWatcherSession) -> Void)?
        private let isSummarizing: Bool
        private let onSummarize: ((SessionWatcherSession) -> Void)?
        private let isFrontmost: Bool
        private var trackingArea: NSTrackingArea?
        private var isHovered = false

        public init(
            session: SessionWatcherSession,
            onTap: ((SessionWatcherSession) -> Void)?,
            isSummarizing: Bool,
            onSummarize: ((SessionWatcherSession) -> Void)?,
            isFrontmost: Bool
        ) {
            self.session = session
            self.onTap = onTap
            self.isSummarizing = isSummarizing
            self.onSummarize = onSummarize
            self.isFrontmost = isFrontmost
            super.init(frame: .zero)
            wantsLayer = true
            layer?.cornerRadius = 6
            layer?.backgroundColor = NSColor.white.withAlphaComponent(0.03).cgColor
            layer?.borderColor = NSColor.white.withAlphaComponent(0.06).cgColor
            layer?.borderWidth = 0.5
            setupViews()
            setupContextMenu()
        }

        @available(*, unavailable)
        public required init?(coder: NSCoder) { fatalError() }

        private func setupViews() {
            let padding: CGFloat = 12

            // --- Header row: project name + dot + spinner + time ---
            let headerRow = NSStackView()
            headerRow.orientation = .horizontal
            headerRow.spacing = 6
            headerRow.alignment = .centerY
            headerRow.translatesAutoresizingMaskIntoConstraints = false

            // Project name (first, upper left)
            let projectLabel = NSTextField(labelWithString: session.projectName)
            projectLabel.font = .systemFont(ofSize: 12, weight: .semibold)
            projectLabel.textColor = .labelColor
            projectLabel.lineBreakMode = .byTruncatingTail
            projectLabel.maximumNumberOfLines = 1
            headerRow.addArrangedSubview(projectLabel)

            // Status dot
            let dot = NSView()
            dot.wantsLayer = true
            dot.layer?.cornerRadius = 3
            let dotColor: NSColor
            if isFrontmost {
                dotColor = .systemBlue
            } else {
                switch session.status {
                case .active: dotColor = .systemGreen
                case .stale: dotColor = .systemYellow
                case .ended: dotColor = .systemGray
                }
            }
            dot.layer?.backgroundColor = dotColor.cgColor
            dot.translatesAutoresizingMaskIntoConstraints = false
            NSLayoutConstraint.activate([
                dot.widthAnchor.constraint(equalToConstant: 6),
                dot.heightAnchor.constraint(equalToConstant: 6)
            ])
            headerRow.addArrangedSubview(dot)

            // Spacer
            let spacer = NSView()
            spacer.setContentHuggingPriority(.defaultLow, for: .horizontal)
            headerRow.addArrangedSubview(spacer)

            if isSummarizing {
                let spinner = NSProgressIndicator()
                spinner.style = .spinning
                spinner.controlSize = .small
                spinner.startAnimation(nil)
                spinner.translatesAutoresizingMaskIntoConstraints = false
                NSLayoutConstraint.activate([
                    spinner.widthAnchor.constraint(equalToConstant: 14),
                    spinner.heightAnchor.constraint(equalToConstant: 14)
                ])
                headerRow.addArrangedSubview(spinner)
            }

            // Relative time
            let timeLabel = NSTextField(labelWithString: relativeTime(session.lastActivityAt))
            timeLabel.font = .monospacedSystemFont(ofSize: 10, weight: .regular)
            timeLabel.textColor = .tertiaryLabelColor
            timeLabel.setContentCompressionResistancePriority(.required, for: .horizontal)
            headerRow.addArrangedSubview(timeLabel)

            addSubview(headerRow)

            // --- Summary line ---
            let summaryText = session.summary.isEmpty ? "thinking..." : session.summary
            let summaryLabel = NSTextField(wrappingLabelWithString: summaryText)
            summaryLabel.font = .systemFont(ofSize: 11)
            summaryLabel.textColor = session.summary.isEmpty ? .tertiaryLabelColor : .secondaryLabelColor
            summaryLabel.maximumNumberOfLines = 2
            summaryLabel.lineBreakMode = .byTruncatingTail
            summaryLabel.translatesAutoresizingMaskIntoConstraints = false
            addSubview(summaryLabel)

            // --- Detail lines: cwd, branch, session ID ---
            let detailStack = NSStackView()
            detailStack.orientation = .vertical
            detailStack.spacing = 2
            detailStack.alignment = .leading
            detailStack.translatesAutoresizingMaskIntoConstraints = false

            if !session.cwd.isEmpty, session.cwd != "/" {
                detailStack.addArrangedSubview(makeDetailLine(
                    icon: "folder",
                    text: tildeAbbreviate(session.cwd)
                ))
            }
            if !session.gitBranch.isEmpty {
                detailStack.addArrangedSubview(makeDetailLine(
                    icon: "arrow.triangle.branch",
                    text: session.gitBranch
                ))
            }
            detailStack.addArrangedSubview(makeDetailLine(
                icon: "terminal",
                text: session.sessionId
            ))
            addSubview(detailStack)

            NSLayoutConstraint.activate([
                headerRow.topAnchor.constraint(equalTo: topAnchor, constant: padding),
                headerRow.leadingAnchor.constraint(equalTo: leadingAnchor, constant: padding),
                headerRow.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -padding),

                summaryLabel.topAnchor.constraint(equalTo: headerRow.bottomAnchor, constant: 4),
                summaryLabel.leadingAnchor.constraint(equalTo: leadingAnchor, constant: padding),
                summaryLabel.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -padding),

                detailStack.topAnchor.constraint(equalTo: summaryLabel.bottomAnchor, constant: 4),
                detailStack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: padding),
                detailStack.trailingAnchor.constraint(lessThanOrEqualTo: trailingAnchor, constant: -padding),
                detailStack.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -padding)
            ])
        }

        private func makeDetailLine(icon: String, text: String) -> NSView {
            let imageView = NSImageView()
            if let image = NSImage(systemSymbolName: icon, accessibilityDescription: nil) {
                imageView.image = image
            }
            imageView.translatesAutoresizingMaskIntoConstraints = false
            imageView.contentTintColor = .tertiaryLabelColor
            NSLayoutConstraint.activate([
                imageView.widthAnchor.constraint(equalToConstant: 11),
                imageView.heightAnchor.constraint(equalToConstant: 11)
            ])

            let label = NSTextField(labelWithString: text)
            label.font = .monospacedSystemFont(ofSize: 9.5, weight: .regular)
            label.textColor = .tertiaryLabelColor
            label.lineBreakMode = .byTruncatingMiddle
            label.maximumNumberOfLines = 1

            let line = NSStackView(views: [imageView, label])
            line.orientation = .horizontal
            line.spacing = 4
            line.alignment = .centerY
            return line
        }

        /// Strips .claude/worktrees/<name>/<project> suffixes to show the real project dir,
        /// then abbreviates the home directory to ~.
        private func tildeAbbreviate(_ path: String) -> String {
            var resolved = path
            // .claude/worktrees/<worktree-name>/<project> → strip to project root
            if let range = resolved.range(of: #"/.claude/worktrees/[^/]+/"#, options: .regularExpression) {
                resolved = String(resolved[resolved.startIndex..<range.lowerBound])
            }
            let home = FileManager.default.homeDirectoryForCurrentUser.path
            if resolved == home { return "~" }
            if resolved.hasPrefix(home + "/") { return "~" + resolved.dropFirst(home.count) }
            return resolved
        }

        private func setupContextMenu() {
            let menu = NSMenu()
            let item = NSMenuItem(title: "Summarize with AI", action: #selector(summarizeAction), keyEquivalent: "")
            item.target = self
            item.isEnabled = !isSummarizing
            menu.addItem(item)
            self.menu = menu
        }

        @objc private func summarizeAction() {
            onSummarize?(session)
        }

        // MARK: - Mouse handling

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

        public override func mouseDown(with event: NSEvent) {
            wantsLayer = true
            layer?.backgroundColor = NSColor.white.withAlphaComponent(0.12).cgColor
        }

        public override func mouseUp(with event: NSEvent) {
            layer?.backgroundColor = isHovered
            ? NSColor.white.withAlphaComponent(0.06).cgColor
            : NSColor.clear.cgColor
            let location = convert(event.locationInWindow, from: nil)
            if bounds.contains(location) {
                onTap?(session)
            }
        }

        // MARK: - Helpers

        private func relativeTime(_ timestamp: String) -> String {
            guard !timestamp.isEmpty else { return "" }
            let formatter = ISO8601DateFormatter()
            if let date = formatter.date(from: timestamp) {
                return relativeTimeFromDate(date)
            }
            formatter.formatOptions.remove(.withFractionalSeconds)
            if let date = formatter.date(from: timestamp) {
                return relativeTimeFromDate(date)
            }
            return ""
        }

        private func relativeTimeFromDate(_ date: Date) -> String {
            let interval = Date().timeIntervalSince(date)
            if interval < 60 { return "now" }
            if interval < 3600 { return "\(Int(interval / 60))m" }
            if interval < 86400 { return "\(Int(interval / 3600))h" }
            return "\(Int(interval / 86400))d"
        }

    }

    // MARK: - Error Banner

    public final class SessionWatcherErrorBanner: NSView {
        private var onOpenSettingsAction: (() -> Void)?

        public init(message: String, isPermissionError: Bool, onOpenSettings: (() -> Void)?) {
            self.onOpenSettingsAction = onOpenSettings
            super.init(frame: .zero)
            wantsLayer = true
            layer?.backgroundColor = (isPermissionError
                                      ? NSColor.systemOrange.withAlphaComponent(0.15)
                                      : NSColor.systemRed.withAlphaComponent(0.15)).cgColor

            let stack = NSStackView()
            stack.orientation = .vertical
            stack.spacing = 4
            stack.translatesAutoresizingMaskIntoConstraints = false

            // Message row
            let messageRow = NSStackView()
            messageRow.orientation = .horizontal
            messageRow.spacing = 6

            let icon = NSImageView()
            icon.image = NSImage(
                systemSymbolName: isPermissionError ? "lock.shield" : "exclamationmark.triangle.fill",
                accessibilityDescription: nil
            )
            icon.contentTintColor = .systemYellow
            icon.translatesAutoresizingMaskIntoConstraints = false
            NSLayoutConstraint.activate([
                icon.widthAnchor.constraint(equalToConstant: 16),
                icon.heightAnchor.constraint(equalToConstant: 16)
            ])

            let label = NSTextField(wrappingLabelWithString: message)
            label.font = .systemFont(ofSize: 11)
            label.maximumNumberOfLines = 3

            messageRow.addArrangedSubview(icon)
            messageRow.addArrangedSubview(label)
            stack.addArrangedSubview(messageRow)

            if isPermissionError {
                let button = NSButton(
                    title: "Open System Settings",
                    target: self,
                    action: #selector(openSettingsClicked)
                )
                button.font = .systemFont(ofSize: 11, weight: .medium)
                button.bezelStyle = .recessed
                stack.addArrangedSubview(button)
            }

            addSubview(stack)
            NSLayoutConstraint.activate([
                stack.topAnchor.constraint(equalTo: topAnchor, constant: 6),
                stack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 10),
                stack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -10),
                stack.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -6)
            ])
        }

        @available(*, unavailable)
        public required init?(coder: NSCoder) { fatalError() }

        @objc private func openSettingsClicked() {
            onOpenSettingsAction?()
        }
    }
}

// MARK: - Terminal App Icon helpers
//
// File-private free helpers because the extension on `SessionWatcher` (an
// enum namespace) can't carry stored properties, and `SessionWatcherGroupCardView`
// is the only consumer.

private let termProgramBundleIDs: [String: String] = [
    "Apple_Terminal": "com.apple.Terminal",
    "iTerm.app": "com.googlecode.iterm2",
    "WarpTerminal": "dev.warp.Warp-Stable",
    "vscode": "com.microsoft.VSCode",
    "tmux": "com.apple.Terminal"
]

private let termProgramDisplayNames: [String: String] = [
    "Apple_Terminal": "Terminal",
    "iTerm.app": "iTerm2",
    "WarpTerminal": "Warp",
    "vscode": "Visual Studio Code",
    "tmux": "tmux (Terminal)"
]

@MainActor
private func terminalAppIcon(for termProgram: String) -> NSImage? {
    guard !termProgram.isEmpty,
          let bundleID = termProgramBundleIDs[termProgram],
          let url = NSWorkspace.shared.urlForApplication(withBundleIdentifier: bundleID) else {
        return nil
    }
    return NSWorkspace.shared.icon(forFile: url.path)
}

private func terminalAppName(for termProgram: String) -> String {
    termProgramDisplayNames[termProgram] ?? termProgram
}
