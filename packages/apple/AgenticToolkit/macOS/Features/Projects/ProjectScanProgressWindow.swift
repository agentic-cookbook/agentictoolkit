import AppKit

import AgenticToolkitCore
import AgenticToolkitCoreUI
import AgenticToolkitCoreMacOS

/// The panel shown while a project scan runs.
///
/// Deliberately not modal and deliberately not cancellable: the scan touches
/// nothing the user could be editing, so blocking them out of the app would buy
/// nothing, and a Cancel button that leaves the registry half-reconciled is
/// worse than a scan that finishes.
@MainActor
public final class ProjectScanProgressWindow: NSWindowController {

    private let headline = ThemedLabel(string: "Scanning for projects…", role: .primaryText, textRole: .heading)
    private let detail = ThemedLabel(string: "", role: .secondaryText, textRole: .caption)
    private let bar = NSProgressIndicator()

    public init() {
        let panel = NSPanel(
            contentRect: NSRect(x: 0, y: 0, width: 420, height: 118),
            styleMask: [.titled, .utilityWindow],
            backing: .buffered,
            defer: false
        )
        panel.title = "Scanning"
        panel.isFloatingPanel = true
        panel.hidesOnDeactivate = false
        panel.becomesKeyOnlyIfNeeded = true
        super.init(window: panel)
        panel.contentView = makeContentView()
        panel.center()
        panel.accessibilityID("project-scan.window")
    }

    @available(*, unavailable)
    public required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    private func makeContentView() -> NSView {
        let container = ThemedBackgroundView(role: .windowBackground)

        bar.style = .bar
        bar.isIndeterminate = true
        bar.controlSize = .small
        bar.usesThreadedAnimation = true

        // The path is the long one; the middle is the part nobody needs to read.
        detail.lineBreakMode = .byTruncatingMiddle
        detail.cell?.usesSingleLineMode = true
        detail.accessibilityID("project-scan.detail")
        headline.accessibilityID("project-scan.headline")

        let stack = NSStackView(views: [headline, bar, detail])
        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = 10
        stack.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(stack)

        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: 20),
            stack.trailingAnchor.constraint(equalTo: container.trailingAnchor, constant: -20),
            stack.centerYAnchor.constraint(equalTo: container.centerYAnchor),
            bar.widthAnchor.constraint(equalTo: stack.widthAnchor)
        ])
        return container
    }

    /// Shows the panel and starts the animation. Ordered front without taking
    /// key, so a scan at launch does not steal focus from whatever the user is
    /// already doing.
    public func present() {
        guard let window else { return }
        bar.startAnimation(nil)
        window.orderFrontRegardless()
    }

    public func update(visited: Int, found: Int, path: String) {
        headline.stringValue = "Scanning for projects — \(found) found"
        detail.stringValue = abbreviate(path)
        _ = visited
    }

    /// Leaves the result on screen just long enough to be read, then closes.
    /// A panel that vanishes the instant the walk ends reads as a flicker
    /// rather than an answer.
    public func finish(summary: ProjectScanSummary) {
        bar.stopAnimation(nil)
        headline.stringValue = "Scan complete"
        detail.stringValue = summary.summaryText
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) { [weak self] in
            self?.close()
        }
    }

    private func abbreviate(_ path: String) -> String {
        let home = FileManager.default.homeDirectoryForCurrentUser.path
        guard path.hasPrefix(home) else { return path }
        return "~" + path.dropFirst(home.count)
    }
}
