import AppKit
import Combine
import SwiftTerm

/// Hosts the active session's terminal view and applies terminal profiles.
///
/// Observes `UserDefaults.didChangeNotification` and
/// `TerminalProfile.didChangeNotification` to reapply the active profile
/// when the app changes it from elsewhere (e.g. a settings pane).
@MainActor
public final class TerminalContentViewController: NSViewController {

    public let sessionManager: TerminalSessionManager
    private var cancellables = Set<AnyCancellable>()
    private var currentSessionID: UUID?
    private var currentProfileID: UUID?

    public init(sessionManager: TerminalSessionManager) {
        self.sessionManager = sessionManager
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

    public override func loadView() {
        let container = NSView()
        container.autoresizesSubviews = true
        self.view = container
    }

    public override func viewDidLoad() {
        super.viewDidLoad()

        sessionManager.$selectedSessionID
            .receive(on: RunLoop.main)
            .sink { [weak self] _ in self?.switchToSelectedSession() }
            .store(in: &cancellables)

        NotificationCenter.default.publisher(for: UserDefaults.didChangeNotification)
            .receive(on: RunLoop.main)
            .sink { [weak self] _ in self?.reapplyProfileIfChanged() }
            .store(in: &cancellables)

        NotificationCenter.default.publisher(for: TerminalProfile.didChangeNotification)
            .receive(on: RunLoop.main)
            .sink { [weak self] _ in self?.reapplyProfile() }
            .store(in: &cancellables)
    }

    private func switchToSelectedSession() {
        let session = sessionManager.selectedSession
        let newID = session?.id
        guard newID != currentSessionID else { return }

        for subview in view.subviews { subview.removeFromSuperview() }

        if let session = session {
            let terminalView = session.terminalView
            terminalView.autoresizingMask = [.width, .height]
            terminalView.frame = view.bounds
            applyProfile(to: terminalView)
            view.addSubview(terminalView)

            DispatchQueue.main.async { [weak terminalView] in
                terminalView?.window?.makeFirstResponder(terminalView)
            }
        }

        currentSessionID = newID
        currentProfileID = resolveProfile().id
    }

    private func reapplyProfileIfChanged() {
        let profile = resolveProfile()
        guard profile.id != currentProfileID else { return }
        reapplyProfile()
    }

    private func reapplyProfile() {
        let profile = resolveProfile()
        currentProfileID = profile.id
        if let terminalView = view.subviews.first as? LocalProcessTerminalView {
            applyProfile(to: terminalView)
        }
    }

    private func resolveProfile() -> TerminalProfile {
        let all = TerminalProfile.builtInProfiles()
        let storedID = UserDefaults.standard.string(forKey: "terminal.activeProfileID")
            ?? TerminalProfile.defaultProfileID
        if let uuid = UUID(uuidString: storedID),
           let match = all.first(where: { $0.id == uuid }) {
            return match
        }
        return all[0]
    }

    private func applyProfile(to terminalView: LocalProcessTerminalView) {
        let profile = resolveProfile()

        if let fg = NSColor(hex: profile.colors.foreground) {
            terminalView.nativeForegroundColor = fg
        }
        if let bg = NSColor(hex: profile.colors.background) {
            terminalView.nativeBackgroundColor = bg
        }
        if let cursor = NSColor(hex: profile.colors.cursor) {
            terminalView.caretColor = cursor
        }
        if let sel = NSColor(hex: profile.colors.selection) {
            terminalView.selectedTextBackgroundColor = sel
        }

        let ansiColors: [SwiftTerm.Color] = profile.colors.ansi.compactMap { hex in
            var hexStr = hex.trimmingCharacters(in: .whitespacesAndNewlines)
            if hexStr.hasPrefix("#") { hexStr = String(hexStr.dropFirst()) }
            guard hexStr.count == 6 else { return nil }
            var rgb: UInt64 = 0
            guard Scanner(string: hexStr).scanHexInt64(&rgb) else { return nil }
            return SwiftTerm.Color(
                red: UInt16((rgb >> 16) & 0xFF) * 257,
                green: UInt16((rgb >> 8) & 0xFF) * 257,
                blue: UInt16(rgb & 0xFF) * 257
            )
        }
        if ansiColors.count == 16 {
            terminalView.installColors(ansiColors)
        }

        if let font = NSFont(name: profile.fontName, size: CGFloat(profile.fontSize)) {
            terminalView.font = font
        }

        terminalView.needsDisplay = true
    }
}
