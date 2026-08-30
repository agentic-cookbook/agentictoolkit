import AppKit

import AgenticToolkitCore
import AgenticToolkitCoreUI
import AgenticToolkitCoreMacOS

/// The small panel shown while a project scan runs.
///
/// A headline and a bar, and nothing else. The counts it used to report were
/// registry bookkeeping the user had not asked for and could not act on, and
/// the path it flickered through was unreadable at the speed the walk produces
/// it — so the panel says the one thing it knows: this is happening, and now it
/// is done.
///
/// Deliberately not modal and deliberately not cancellable: the scan touches
/// nothing the user could be editing, so blocking them out of the app would buy
/// nothing, and a Cancel button that leaves the registry half-reconciled is
/// worse than a scan that finishes.
@MainActor
public final class ProjectScanProgressWindow: NSWindowController {

    /// How long the finished panel stays up. Long enough to register as an
    /// answer, short enough not to be in the way.
    private static let lingerAfterFinishing: TimeInterval = 1.0

    private let headline = ThemedLabel(string: "Scanning for projects…", role: .primaryText, textRole: .body)
    private let bar = NSProgressIndicator()

    public init() {
        let panel = NSPanel(
            contentRect: NSRect(x: 0, y: 0, width: 240, height: 72),
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
        bar.minValue = 0
        bar.maxValue = 1

        headline.accessibilityID("project-scan.headline")

        let stack = NSStackView(views: [headline, bar])
        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = 8
        stack.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(stack)

        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: 16),
            stack.trailingAnchor.constraint(equalTo: container.trailingAnchor, constant: -16),
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

    /// Fills the bar, says so, and closes a second later.
    ///
    /// The bar ends full rather than mid-stride: an indeterminate bar frozen
    /// part-way through reads as a scan that gave up.
    public func finish() {
        bar.stopAnimation(nil)
        bar.isIndeterminate = false
        bar.doubleValue = bar.maxValue
        headline.stringValue = "Scan complete"
        // Strongly captured on purpose: the caller drops its reference as soon
        // as it has asked for the finish, so a weak capture leaves nothing
        // alive to run `close()` and the panel stays on screen for good. The
        // closure fires once and releases.
        DispatchQueue.main.asyncAfter(deadline: .now() + Self.lingerAfterFinishing) {
            self.close()
        }
    }
}
