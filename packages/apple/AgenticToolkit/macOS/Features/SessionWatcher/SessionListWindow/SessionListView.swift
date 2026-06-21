import AppKit
import Combine
import AgenticToolkitCore
import AgenticToolkitCoreMacOS
import AgenticToolkitPermissions

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
            accessibilityID("session-panel.list")
            setupViews()
            bindViewModel()
        }

        @available(*, unavailable)
        public required init?(coder: NSCoder) { fatalError() }

        /// Notification posted when content changes and the panel should resize.
        public static let contentSizeDidChangeNotification = Notification.Name("SessionContentViewContentSizeDidChange")

        public override var intrinsicContentSize: NSSize {
            // No session cards → the empty-state view is what's visible. Report its
            // height so the host window sizes to show it. Reporting the empty stack's
            // collapsed inset height instead would shrink the list area to nothing and
            // the centered "No Active Sessions" content would overflow up into the
            // header (the empty-state UI the user saw as "mangled").
            if stackView.arrangedSubviews.isEmpty {
                return NSSize(width: NSView.noIntrinsicMetric, height: emptyStateView.intrinsicContentSize.height)
            }
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
                .combineLatest(viewModel.$lastRequiredPermission)
                .receive(on: DispatchQueue.main)
                .sink { [weak self] error, permission in
                    self?.updateErrorBanner(error: error, requiredPermission: permission)
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

        private func updateErrorBanner(error: String?, requiredPermission: Permission?) {
            errorBanner?.removeFromSuperview()
            errorBanner = nil

            guard let error else { return }

            let banner = SessionWatcherErrorBanner(
                message: error,
                isPermissionError: requiredPermission != nil,
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
        /// Natural footprint for the empty state: the dog icon + "No Active Sessions"
        /// label centered with comfortable vertical breathing room. Vended as the
        /// view's intrinsic height so the host window sizes to display it instead of
        /// collapsing the list area to nothing (which crushes the centered content up
        /// into the header above). See `SessionListView.intrinsicContentSize`.
        public static let preferredHeight: CGFloat = 80

        private var iconView: NSImageView!
        private var label: NSTextField!
        private var themeObserver: ThemePaletteObserver?

        public override init(frame: NSRect) {
            super.init(frame: frame)
            accessibilityID("session-panel.empty-state")
            setupViews()
            themeObserver = ThemePaletteObserver { [weak self] palette in self?.applyTheme(palette) }
        }

        @available(*, unavailable)
        public required init?(coder: NSCoder) { fatalError() }

        public override var intrinsicContentSize: NSSize {
            NSSize(width: NSView.noIntrinsicMetric, height: Self.preferredHeight)
        }

        private func setupViews() {
            iconView = NSImageView()
            iconView.image = NSImage(systemSymbolName: "dog.fill", accessibilityDescription: nil)
            iconView.symbolConfiguration = .init(pointSize: 24, weight: .regular)
            iconView.translatesAutoresizingMaskIntoConstraints = false

            label = NSTextField(labelWithString: "No Active Sessions")
            label.alignment = .center
            label.translatesAutoresizingMaskIntoConstraints = false

            let stack = NSStackView(views: [iconView, label])
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

        private func applyTheme(_ palette: SemanticPalette) {
            iconView.contentTintColor = palette.secondaryTextColor
            label.textColor = palette.secondaryTextColor
            label.font = palette.font(.caption)
        }
    }

    // MARK: - SessionWatcherSession Group Card View

    public final class SessionWatcherGroupCardView: NSView {
        private let group: SessionWatcherGroup
        private let onSessionClick: ((SessionWatcherSession) -> Void)?
        private let summarizingSessionIds: Set<String>
        private let onSummarize: ((SessionWatcherSession) -> Void)?
        private let frontmostSessionId: String?

        // Theme-sensitive subviews
        private var folderIconView: NSImageView!
        private var titleLabel: NSTextField!
        private var countLabel: NSTextField!
        private var dividerView: NSBox!
        private var noneLabel: NSTextField?
        private var themeObserver: ThemePaletteObserver?

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
            accessibilityID("session-panel.group.\(AccessibilityID.slug(group.projectName))")
            wantsLayer = true
            layer?.cornerRadius = 8
            setupViews()
            themeObserver = ThemePaletteObserver { [weak self] palette in self?.applyTheme(palette) }
        }

        @available(*, unavailable)
        public required init?(coder: NSCoder) { fatalError() }

        private func applyTheme(_ palette: SemanticPalette) {
            layer?.backgroundColor = palette.surfaceColor.cgColor
            layer?.borderColor = palette.borderColor.cgColor
            layer?.borderWidth = 0.5
            folderIconView.contentTintColor = palette.secondaryTextColor
            titleLabel.textColor = palette.primaryTextColor
            titleLabel.font = palette.font(.heading)
            countLabel.textColor = palette.tertiaryTextColor
            countLabel.font = palette.font(.caption)
            noneLabel?.textColor = palette.tertiaryTextColor
            noneLabel?.font = palette.font(.caption)
            // NSBox separator color is driven by the system; tint via layer instead
            dividerView.alphaValue = 0.3
        }

        private func setupViews() {
            let stack = NSStackView()
            stack.orientation = .vertical
            stack.spacing = 0
            stack.translatesAutoresizingMaskIntoConstraints = false

            // Header
            let header = makeSessionHeader()
            stack.addArrangedSubview(header)

            let divider = makeDivider()
            dividerView = divider
            stack.addArrangedSubview(divider)

            // Sessions
            if group.sessions.isEmpty {
                let none = NSTextField(labelWithString: "None")
                noneLabel = none
                let wrapper = NSView()
                wrapper.translatesAutoresizingMaskIntoConstraints = false
                none.translatesAutoresizingMaskIntoConstraints = false
                wrapper.addSubview(none)
                NSLayoutConstraint.activate([
                    none.leadingAnchor.constraint(equalTo: wrapper.leadingAnchor, constant: 10),
                    none.topAnchor.constraint(equalTo: wrapper.topAnchor, constant: 6),
                    none.bottomAnchor.constraint(equalTo: wrapper.bottomAnchor, constant: -6)
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

            // Folder icon — the group is a project (git) directory now.
            let iconView = NSImageView()
            iconView.image = NSImage(systemSymbolName: "folder.fill", accessibilityDescription: nil)
            iconView.symbolConfiguration = .init(pointSize: 18, weight: .regular)
            iconView.toolTip = group.id  // full project-root path
            iconView.translatesAutoresizingMaskIntoConstraints = false
            container.addSubview(iconView)
            folderIconView = iconView

            let title = NSTextField(labelWithString: group.projectName)
            title.lineBreakMode = .byTruncatingTail
            title.maximumNumberOfLines = 1
            title.toolTip = group.id
            title.translatesAutoresizingMaskIntoConstraints = false
            titleLabel = title

            let suffix = group.sessions.count == 1 ? "" : "s"
            let count = NSTextField(labelWithString: "\(group.sessions.count) session\(suffix)")
            count.setContentCompressionResistancePriority(.required, for: .horizontal)
            count.translatesAutoresizingMaskIntoConstraints = false
            countLabel = count

            container.addSubview(title)
            container.addSubview(count)

            NSLayoutConstraint.activate([
                container.heightAnchor.constraint(greaterThanOrEqualToConstant: 40),

                iconView.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: 10),
                iconView.centerYAnchor.constraint(equalTo: container.centerYAnchor),
                iconView.widthAnchor.constraint(equalToConstant: 22),
                iconView.heightAnchor.constraint(equalToConstant: 22),

                title.leadingAnchor.constraint(equalTo: iconView.trailingAnchor, constant: 8),
                title.centerYAnchor.constraint(equalTo: container.centerYAnchor),

                count.trailingAnchor.constraint(equalTo: container.trailingAnchor, constant: -10),
                count.centerYAnchor.constraint(equalTo: container.centerYAnchor),
                count.leadingAnchor.constraint(greaterThanOrEqualTo: title.trailingAnchor, constant: 5)
            ])

            return container
        }

        private func makeDivider() -> NSBox {
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

        // Theme-sensitive subviews
        private var projectLabel: NSTextField!
        private var statusDot: NSView!
        private var timeLabel: NSTextField!
        private var summaryLabel: NSTextField!
        private var detailIconViews: [NSImageView] = []
        private var detailLabels: [NSTextField] = []
        private var themeObserver: ThemePaletteObserver?

        // Cached status for theming the dot color correctly
        private let dotStatus: SessionWatcher.SessionWatcherStatus
        private let isFrontmostSession: Bool

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
            self.dotStatus = session.status
            self.isFrontmostSession = isFrontmost
            super.init(frame: .zero)
            accessibilityID("session-panel.row.\(session.sessionId)")
            wantsLayer = true
            layer?.cornerRadius = 6
            setupViews()
            setupContextMenu()
            themeObserver = ThemePaletteObserver { [weak self] palette in self?.applyTheme(palette) }
        }

        @available(*, unavailable)
        public required init?(coder: NSCoder) { fatalError() }

        private func applyTheme(_ palette: SemanticPalette) {
            // Card background: subtle surface tint (idle)
            layer?.backgroundColor = palette.surfaceColor.withAlphaComponent(0.5).cgColor
            layer?.borderColor = palette.borderColor.cgColor
            layer?.borderWidth = 0.5

            // Header row labels
            projectLabel.textColor = palette.primaryTextColor
            projectLabel.font = palette.font(.body)

            // Status dot color
            let dotColor: NSColor
            if isFrontmostSession {
                dotColor = palette.accentColor
            } else {
                switch dotStatus {
                case .active: dotColor = palette.successColor
                case .stale:  dotColor = palette.warningColor
                case .ended:  dotColor = palette.tertiaryTextColor
                }
            }
            statusDot.layer?.backgroundColor = dotColor.cgColor

            // Time label
            timeLabel.textColor = palette.tertiaryTextColor
            timeLabel.font = palette.font(.code)

            // Summary line
            summaryLabel.textColor = session.summary.isEmpty
                ? palette.tertiaryTextColor
                : palette.secondaryTextColor
            summaryLabel.font = palette.font(.caption)

            // Detail lines (cwd / branch / session ID)
            for iconView in detailIconViews {
                iconView.contentTintColor = palette.tertiaryTextColor
            }
            for lbl in detailLabels {
                lbl.textColor = palette.tertiaryTextColor
                lbl.font = palette.font(.code)
            }
        }

        /// App icon for the terminal a session runs in, from its `TERM_PROGRAM`.
        /// Prefers a running instance's icon, falls back to the installed app
        /// bundle, then a generic terminal glyph for unknown/empty terminals.
        private static func appIcon(forTermProgram termProgram: String) -> NSImage? {
            let bundleIDs: [String: String] = [
                "iTerm.app": "com.googlecode.iterm2",
                "Apple_Terminal": "com.apple.Terminal",
                "WarpTerminal": "dev.warp.Warp-Stable",
                "vscode": "com.microsoft.VSCode",
                "tmux": "com.apple.Terminal"
            ]
            if let bundleID = bundleIDs[termProgram] {
                if let running = NSRunningApplication
                    .runningApplications(withBundleIdentifier: bundleID).first?.icon {
                    return running
                }
                if let url = NSWorkspace.shared.urlForApplication(withBundleIdentifier: bundleID) {
                    return NSWorkspace.shared.icon(forFile: url.path)
                }
            }
            return NSImage(systemSymbolName: "terminal", accessibilityDescription: "terminal")
        }

        private func setupViews() {
            let padding: CGFloat = 12

            // --- Header row: project name + dot + spinner + time ---
            let headerRow = NSStackView()
            headerRow.orientation = .horizontal
            headerRow.spacing = 6
            headerRow.alignment = .centerY
            headerRow.translatesAutoresizingMaskIntoConstraints = false

            // App icon for the terminal the session runs in (leftmost in the header).
            let iconView = NSImageView()
            iconView.image = Self.appIcon(forTermProgram: session.termProgram)
            iconView.imageScaling = .scaleProportionallyUpOrDown
            iconView.toolTip = session.termProgram.isEmpty ? nil : session.termProgram
            iconView.translatesAutoresizingMaskIntoConstraints = false
            NSLayoutConstraint.activate([
                iconView.widthAnchor.constraint(equalToConstant: 15),
                iconView.heightAnchor.constraint(equalToConstant: 15)
            ])
            headerRow.addArrangedSubview(iconView)

            // Project name (first, upper left)
            let projLabel = NSTextField(labelWithString: session.projectName)
            projLabel.lineBreakMode = .byTruncatingTail
            projLabel.maximumNumberOfLines = 1
            headerRow.addArrangedSubview(projLabel)
            projectLabel = projLabel

            // Status dot
            let dot = NSView()
            dot.wantsLayer = true
            dot.layer?.cornerRadius = 3
            dot.translatesAutoresizingMaskIntoConstraints = false
            NSLayoutConstraint.activate([
                dot.widthAnchor.constraint(equalToConstant: 6),
                dot.heightAnchor.constraint(equalToConstant: 6)
            ])
            headerRow.addArrangedSubview(dot)
            statusDot = dot

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
            let timeLbl = NSTextField(labelWithString: relativeTime(session.lastActivityAt))
            timeLbl.setContentCompressionResistancePriority(.required, for: .horizontal)
            headerRow.addArrangedSubview(timeLbl)
            timeLabel = timeLbl

            addSubview(headerRow)

            // --- Summary line ---
            let summaryText = session.summary.isEmpty ? "thinking..." : session.summary
            let summaryLbl = NSTextField(wrappingLabelWithString: summaryText)
            summaryLbl.maximumNumberOfLines = 2
            summaryLbl.lineBreakMode = .byTruncatingTail
            summaryLbl.translatesAutoresizingMaskIntoConstraints = false
            addSubview(summaryLbl)
            summaryLabel = summaryLbl

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

                summaryLbl.topAnchor.constraint(equalTo: headerRow.bottomAnchor, constant: 4),
                summaryLbl.leadingAnchor.constraint(equalTo: leadingAnchor, constant: padding),
                summaryLbl.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -padding),

                detailStack.topAnchor.constraint(equalTo: summaryLbl.bottomAnchor, constant: 4),
                detailStack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: padding),
                detailStack.trailingAnchor.constraint(lessThanOrEqualTo: trailingAnchor, constant: -padding),
                detailStack.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -padding)
            ])
        }

        private func makeDetailLine(icon: String, text: String) -> NSView {
            let imgView = NSImageView()
            if let image = NSImage(systemSymbolName: icon, accessibilityDescription: nil) {
                imgView.image = image
            }
            imgView.translatesAutoresizingMaskIntoConstraints = false
            NSLayoutConstraint.activate([
                imgView.widthAnchor.constraint(equalToConstant: 11),
                imgView.heightAnchor.constraint(equalToConstant: 11)
            ])
            detailIconViews.append(imgView)

            let lbl = NSTextField(labelWithString: text)
            lbl.lineBreakMode = .byTruncatingMiddle
            lbl.maximumNumberOfLines = 1
            detailLabels.append(lbl)

            let line = NSStackView(views: [imgView, lbl])
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
            let palette = ThemePaletteObserver.currentPalette
            layer?.backgroundColor = palette.selectionColor.withAlphaComponent(0.18).cgColor
        }

        public override func mouseExited(with event: NSEvent) {
            isHovered = false
            let palette = ThemePaletteObserver.currentPalette
            layer?.backgroundColor = palette.surfaceColor.withAlphaComponent(0.5).cgColor
        }

        public override func mouseDown(with event: NSEvent) {
            let palette = ThemePaletteObserver.currentPalette
            layer?.backgroundColor = palette.selectionColor.withAlphaComponent(0.35).cgColor
        }

        public override func mouseUp(with event: NSEvent) {
            let palette = ThemePaletteObserver.currentPalette
            layer?.backgroundColor = isHovered
                ? palette.selectionColor.withAlphaComponent(0.18).cgColor
                : palette.surfaceColor.withAlphaComponent(0.5).cgColor
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
        private let isPermissionError: Bool
        private var bannerLabel: NSTextField!
        private var warningIcon: NSImageView!
        private var themeObserver: ThemePaletteObserver?

        public init(message: String, isPermissionError: Bool, onOpenSettings: (() -> Void)?) {
            self.onOpenSettingsAction = onOpenSettings
            self.isPermissionError = isPermissionError
            super.init(frame: .zero)
            accessibilityID("session-panel.error-banner")
            wantsLayer = true
            setupViews(message: message, isPermissionError: isPermissionError)
            themeObserver = ThemePaletteObserver { [weak self] palette in self?.applyTheme(palette) }
        }

        @available(*, unavailable)
        public required init?(coder: NSCoder) { fatalError() }

        private func applyTheme(_ palette: SemanticPalette) {
            let bgColor = isPermissionError
                ? palette.warningColor.withAlphaComponent(0.15)
                : palette.dangerColor.withAlphaComponent(0.15)
            layer?.backgroundColor = bgColor.cgColor
            bannerLabel.textColor = palette.primaryTextColor
            bannerLabel.font = palette.font(.caption)
            warningIcon.contentTintColor = palette.warningColor
        }

        private func setupViews(message: String, isPermissionError: Bool) {
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
            icon.translatesAutoresizingMaskIntoConstraints = false
            NSLayoutConstraint.activate([
                icon.widthAnchor.constraint(equalToConstant: 16),
                icon.heightAnchor.constraint(equalToConstant: 16)
            ])
            warningIcon = icon

            let lbl = NSTextField(wrappingLabelWithString: message)
            lbl.font = .systemFont(ofSize: 11)
            lbl.maximumNumberOfLines = 3
            bannerLabel = lbl

            messageRow.addArrangedSubview(icon)
            messageRow.addArrangedSubview(lbl)
            stack.addArrangedSubview(messageRow)

            if isPermissionError {
                let button = NSButton(
                    title: "Open System Settings",
                    target: self,
                    action: #selector(openSettingsClicked)
                )
                button.font = .systemFont(ofSize: 11, weight: .medium)
                button.bezelStyle = .recessed
                button.accessibilityID("session-panel.error-banner.open-settings")
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

        @objc private func openSettingsClicked() {
            onOpenSettingsAction?()
        }
    }
}
