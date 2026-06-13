import AppKit
import Combine
import Foundation
import AgenticToolkitCore
import AgenticToolkitCoreMacOS
import AgenticToolkitMacOS

/// Composes the toolkit's window-context stack into the host app.
///
/// This feature is the proof that the SystemWindows components are reusable with
/// no app-specific code: it builds a ``SystemWindowContextsModel`` from an
/// Agentic Toolkit configuration and wires up the discovery window, context
/// picker, settings window, and global shortcuts entirely from toolkit types.
/// The only host-supplied input is the ``SystemWindowContextsConfiguration``
/// (branding + first-launch defaults) and the state directory.
@MainActor
final class WindowContextsCoordinator: AppFeature {

    let model: SystemWindowContextsModel

    private let discoveryController: SystemWindowDiscoveryWindowController
    private let settingsController: SystemWindowSettingsWindowController
    private let reconcileController: SystemWindowReconcileWindowController
    private var pickerPanel: SystemWindowContextPickerPanel?
    private var shortcutManager: SystemWindowShortcutManager?
    private var pickerDismissObserver: NSObjectProtocol?
    private var cancellables = Set<AnyCancellable>()

    override init() {
        let windowManager = SystemWindowManager()
        let stateStore = SystemWindowContextStore(rootDirectory: Self.stateDirectory)
        let contextManager = SystemWindowContextManager(
            windowManager: windowManager,
            stateStore: stateStore
        )
        let model = SystemWindowContextsModel(
            contextManager: contextManager,
            windowManager: windowManager,
            configuration: .agenticToolkit
        )
        self.model = model
        self.discoveryController = SystemWindowDiscoveryWindowController(model: model)
        self.settingsController = SystemWindowSettingsWindowController(model: model)
        // Self-observes `showReconcileWindow`; retaining it is enough to surface
        // the reconcile prompt when launch re-matching leaves unmatched windows.
        self.reconcileController = SystemWindowReconcileWindowController(model: model)

        super.init()

        self.menuContributions = [
            MenuContribution(
                slot: .statusItem(section: 5), title: "Discover Windows…", order: 10
            ) { [weak self] in
                self?.discoveryController.showWindow()
            },
            MenuContribution(
                slot: .statusItem(section: 5), title: "Pick \(model.contextNoun)…", order: 20
            ) { [weak self] in
                self?.model.toggleContextPicker()
            },
            MenuContribution(
                slot: .statusItem(section: 5), title: "\(model.contextNounPlural) Settings…", order: 30
            ) { [weak self] in
                self?.settingsController.showWindow()
            }
        ]
    }

    // MARK: - AppFeature

    override func start() throws {
        model.loadState()
        // Retained for the lifetime of the feature; installs the global event tap.
        shortcutManager = SystemWindowShortcutManager(model: model)
        observePickerVisibility()
        model.performLaunchReconciliation()
        model.startWindowObservation()
        Self.logger.info("WindowContexts feature started")
    }

    // MARK: - Picker presentation

    /// Bridges the model's `showContextPicker` flag (flipped by the global
    /// `^⌥Space` shortcut) to the floating panel. A SwiftUI host does this with
    /// `.onChange`; an AppKit host observes the published flag directly.
    private func observePickerVisibility() {
        model.$showContextPicker
            .receive(on: RunLoop.main)
            .sink { [weak self] shouldShow in
                guard let self else { return }
                if shouldShow {
                    self.showPicker()
                } else {
                    self.pickerPanel?.orderOut(nil)
                }
            }
            .store(in: &cancellables)

        // The panel dismisses itself on Escape / focus loss; route that back into
        // the model through the shared helper, retaining the token so `deinit`
        // can remove it.
        pickerDismissObserver = SystemWindowContextPickerPanel.observeDismissal(updating: model)
    }

    override func stop() {
        super.stop()
        if let observer = pickerDismissObserver {
            NotificationCenter.default.removeObserver(observer)
            pickerDismissObserver = nil
        }
    }

    private func showPicker() {
        if pickerPanel == nil {
            pickerPanel = SystemWindowContextPickerPanel(model: model)
        }
        pickerPanel?.showCentered()
    }

    /// State lives under `~/.config/agentic-toolkit/window-contexts`, parallel to
    /// Hairball's `~/.config/hairball` — each host keeps its own contexts.
    private static var stateDirectory: URL {
        FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent(".config/agentic-toolkit/window-contexts", isDirectory: true)
    }
}

extension WindowContextsCoordinator: Loggable {
    static nonisolated let logger = makeLogger()
}

extension SystemWindowContextsConfiguration {
    /// Agentic Toolkit's branding and first-launch default workspaces. Mirrors
    /// the shape of Hairball's `.hairball` configuration — proving a second host
    /// drives the same engine purely through configuration.
    static let agenticToolkit = SystemWindowContextsConfiguration(
        selfAppName: "Agentic Toolkit",
        settingsKey: "com.agentic-toolkit.app.windowcontexts.settings",
        contextNoun: "Workspace",
        contextNounPlural: "Workspaces",
        notificationTitle: "Agentic Toolkit",
        notificationIdentifier: "agentic-toolkit-windowcontexts-reconcile",
        defaultContexts: [
            .init(name: "Build", color: "#007AFF"),       // Blue
            .init(name: "Review", color: "#FF9500"),      // Orange
            .init(name: "Docs", color: "#AF52DE")         // Purple
        ],
        // A regular app owns its own activation model; don't expose a
        // "Show App in Dock" toggle that would override it.
        managesAppActivationPolicy: false
    )
}
