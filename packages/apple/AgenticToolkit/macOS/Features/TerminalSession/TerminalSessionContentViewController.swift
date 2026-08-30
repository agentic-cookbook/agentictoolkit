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
    /// the padding setting can move them without rebuilding the view.
    private var paddingConstraints: [NSLayoutConstraint] = []

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
        paddingConstraints = []

        if let session {
            let terminalView = session.terminalView
            terminalView.translatesAutoresizingMaskIntoConstraints = false
            view.addSubview(terminalView)

            let padding = TerminalAppearance.resolvedPadding()
            paddingConstraints = [
                terminalView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: padding),
                terminalView.topAnchor.constraint(equalTo: view.topAnchor, constant: padding),
                view.trailingAnchor.constraint(equalTo: terminalView.trailingAnchor, constant: padding),
                view.bottomAnchor.constraint(equalTo: terminalView.bottomAnchor, constant: padding)
            ]
            NSLayoutConstraint.activate(paddingConstraints)

            TerminalAppearance.apply(to: terminalView, palette: ThemePaletteObserver.currentPalette)

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
        let padding = TerminalAppearance.resolvedPadding()
        for constraint in paddingConstraints {
            constraint.constant = padding
        }

        guard let terminalView = view.subviews.first as? LocalProcessTerminalView else { return }
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
