import AppKit
import Combine
import SwiftTerm

import AgenticToolkitCore
import AgenticToolkitCoreMacOS

/// Hosts the active session's terminal view.
///
/// Colors come from the app theme and font/caret/padding from the terminal
/// settings — both live, so changing either repaints an open shell rather than
/// waiting for a new one.
@MainActor
public final class TerminalSessionContentViewController: NSViewController {

    public let sessionManager: TerminalSessionManager

    private var cancellables = Set<AnyCancellable>()
    private var themeObserver: ThemePaletteObserver?
    private var currentSessionID: UUID?

    /// The four insets holding the terminal off the container's edges, kept so
    /// the padding settings can move them without rebuilding the view. Named
    /// individually because each side is its own setting.
    private var paddingConstraints: (
        top: NSLayoutConstraint,
        leading: NSLayoutConstraint,
        bottom: NSLayoutConstraint,
        trailing: NSLayoutConstraint
    )?

    public init(sessionManager: TerminalSessionManager) {
        self.sessionManager = sessionManager
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    public required init?(coder: NSCoder) { fatalError() }

    public override func loadView() {
        // The backdrop is the terminal's own background color, so the padding
        // reads as breathing room inside the terminal rather than a frame
        // around it.
        let container = ThemedBackgroundView(role: .windowBackground)
        container.frame = NSRect(x: 0, y: 0, width: 800, height: 600)
        self.view = container
    }

    public override func viewDidLoad() {
        super.viewDidLoad()

        sessionManager.$selectedSessionID
            .receive(on: RunLoop.main)
            .sink { [weak self] _ in self?.switchToSelectedSession() }
            .store(in: &cancellables)

        UserSettings.shared.changes
            .filter { TerminalAppearance.settingKeys.contains($0) }
            .receive(on: RunLoop.main)
            .sink { [weak self] _ in self?.reapplyAppearance() }
            .store(in: &cancellables)

        // Fires immediately with the current palette, which is what paints the
        // first terminal — so there is no separate "apply on load" path.
        themeObserver = ThemePaletteObserver { [weak self] palette in
            self?.applyAppearance(palette: palette)
        }
    }

    private func switchToSelectedSession() {
        let session = sessionManager.selectedSession
        let newID = session?.id
        guard newID != currentSessionID else { return }

        for subview in view.subviews { subview.removeFromSuperview() }
        paddingConstraints = nil

        if let session {
            let terminalView = session.terminalView
            terminalView.translatesAutoresizingMaskIntoConstraints = false
            view.addSubview(terminalView)

            let constraints = (
                top: terminalView.topAnchor.constraint(equalTo: view.topAnchor),
                leading: terminalView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
                bottom: view.bottomAnchor.constraint(equalTo: terminalView.bottomAnchor),
                trailing: view.trailingAnchor.constraint(equalTo: terminalView.trailingAnchor)
            )
            paddingConstraints = constraints
            NSLayoutConstraint.activate([
                constraints.top, constraints.leading, constraints.bottom, constraints.trailing
            ])

            // Goes through the same path as a later settings change, so the
            // constraints get their constants from one place (`dry`).
            applyAppearance(palette: ThemePaletteObserver.currentPalette)

            DispatchQueue.main.async { [weak terminalView] in
                terminalView?.window?.makeFirstResponder(terminalView)
            }
        }

        currentSessionID = newID
    }

    private func reapplyAppearance() {
        applyAppearance(palette: ThemePaletteObserver.currentPalette)
    }

    private func applyAppearance(palette: SemanticPalette) {
        if let paddingConstraints {
            let padding = TerminalAppearance.resolvedPadding(theme: palette.theme)
            paddingConstraints.top.constant = padding.top
            paddingConstraints.leading.constant = padding.leading
            paddingConstraints.bottom.constant = padding.bottom
            paddingConstraints.trailing.constant = padding.trailing
        }

        guard let terminalView = view.subviews.first as? TerminalView else { return }
        TerminalAppearance.apply(to: terminalView, palette: palette)
    }
}

extension TerminalSessionContentViewController: PaneContentTeardown {
    /// Closing the pane kills its shells. "Released whenever the last reference
    /// drops" is not good enough for a child process.
    public func paneContentWillBeDiscarded() {
        sessionManager.terminateAll()
    }
}

extension TerminalSessionContentViewController: PaneContentRemovalConfirmation {
    /// Closing the pane kills its shells, and a shell can be halfway through
    /// something the user would rather not lose.
    public var removalConfirmationMessage: String? {
        let count = sessionManager.sessions.count
        guard count > 0 else { return nil }
        return count == 1
            ? "This pane has a running terminal session. Removing the pane ends it."
            : "This pane has \(count) running terminal sessions. Removing the pane ends them."
    }
}
