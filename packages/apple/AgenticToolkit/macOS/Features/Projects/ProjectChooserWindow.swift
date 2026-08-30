import AppKit
import AgenticToolkitCore
import AgenticToolkitCoreUI
import AgenticToolkitCoreMacOS

/// The modal "which project?" dialog — a `ProjectBrowserViewController` in
/// chooser mode with the two buttons a dialog owes the user.
///
/// App-modal rather than a sheet: this app has no window guaranteed to be on
/// screen when the question is asked (it can be asked from the menu bar with
/// nothing open at all), and a sheet with no parent cannot be dismissed.
@MainActor
public final class ProjectChooserWindow: NSWindowController {

    private let content: ProjectChooserContentViewController
    private var chosen: GitRepo?

    /// Runs the chooser and calls `onChoose` with the picked project, or not at
    /// all if the user cancels.
    public static func choose(
        from coordinator: ProjectsCoordinator,
        onChoose: @escaping (GitRepo) -> Void
    ) {
        let controller = ProjectChooserWindow(coordinator: coordinator)
        if let repo = controller.runModal() {
            onChoose(repo)
        }
    }

    public init(coordinator: ProjectsCoordinator) {
        self.content = ProjectChooserContentViewController(coordinator: coordinator)

        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 460, height: 480),
            styleMask: [.titled, .closable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "Open Project"
        window.minSize = NSSize(width: 360, height: 300)
        super.init(window: window)

        window.contentViewController = content
        window.setContentSize(NSSize(width: 460, height: 480))
        window.center()
        window.accessibilityID("project-chooser.window")

        content.onFinish = { [weak self] repo in self?.finish(with: repo) }
    }

    @available(*, unavailable)
    public required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    @discardableResult
    public func runModal() -> GitRepo? {
        guard let window else { return nil }
        // A menu bar app is often not the active app when this is asked for.
        NSApp.activate(ignoringOtherApps: true)
        window.makeKeyAndOrderFront(nil)
        NSApp.runModal(for: window)
        window.orderOut(nil)
        return chosen
    }

    private func finish(with repo: GitRepo?) {
        chosen = repo
        NSApp.stopModal()
    }
}

/// The chooser's content: the browser plus Cancel/Open. Split out so the
/// browser has a real parent view controller and gets its appearance callbacks
/// (that is where it takes first responder).
@MainActor
private final class ProjectChooserContentViewController: NSViewController {

    /// Called with the chosen project, or `nil` when the user cancels.
    var onFinish: ((GitRepo?) -> Void)?

    private let browser: ProjectBrowserViewController
    private let openButton = ThemedButton(title: "Open")

    init(coordinator: ProjectsCoordinator) {
        self.browser = ProjectBrowserViewController(coordinator: coordinator, mode: .chooser)
        super.init(nibName: nil, bundle: nil)
        browser.onChoose = { [weak self] repo in self?.onFinish?(repo) }
        browser.onSelectionChange = { [weak self] repo in self?.openButton.isEnabled = repo != nil }
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) is not supported") }

    override func loadView() {
        let container = ThemedBackgroundView(role: .windowBackground)

        let cancel = ThemedButton(title: "Cancel", target: self, action: #selector(cancelChoosing(_:)))
        cancel.keyEquivalent = "\u{1b}"
        cancel.accessibilityID("project-chooser.cancel")

        openButton.target = self
        openButton.action = #selector(openChosen(_:))
        openButton.isEnabled = false
        openButton.accessibilityID("project-chooser.open")

        let buttons = NSStackView(views: [cancel, openButton])
        buttons.orientation = .horizontal
        buttons.spacing = 10
        buttons.translatesAutoresizingMaskIntoConstraints = false

        addChild(browser)
        let browserView = browser.view
        browserView.translatesAutoresizingMaskIntoConstraints = false

        container.addSubview(browserView)
        container.addSubview(buttons)

        NSLayoutConstraint.activate([
            browserView.topAnchor.constraint(equalTo: container.topAnchor),
            browserView.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            browserView.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            browserView.bottomAnchor.constraint(equalTo: buttons.topAnchor, constant: -10),

            buttons.trailingAnchor.constraint(equalTo: container.trailingAnchor, constant: -14),
            buttons.bottomAnchor.constraint(equalTo: container.bottomAnchor, constant: -14),
            buttons.leadingAnchor.constraint(greaterThanOrEqualTo: container.leadingAnchor, constant: 14)
        ])

        self.view = container
    }

    @objc private func openChosen(_ sender: Any?) {
        onFinish?(browser.selectedRepo)
    }

    @objc private func cancelChoosing(_ sender: Any?) {
        onFinish?(nil)
    }
}
