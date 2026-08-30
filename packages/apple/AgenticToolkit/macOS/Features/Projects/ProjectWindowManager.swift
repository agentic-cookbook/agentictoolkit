import AppKit
import os
import AgenticToolkitCore

/// Keeps one window per project, keyed by `git_repo.id`.
///
/// The key is the row id and not the path, so opening "the same project" twice
/// means the same window even after the repository has been moved or renamed —
/// which is the whole reason the registry has ids in the first place.
@MainActor
public final class ProjectWindowManager: ProjectOpening {

    public static let shared = ProjectWindowManager()

    private var controllers: [UUID: ComposableTabsWindowController] = [:]
    private var closeObservers: [UUID: NSObjectProtocol] = [:]
    private weak var coordinator: ProjectsCoordinator?

    public init() {}

    /// Wires the manager to the registry it opens projects from and registers
    /// itself as that registry's opener.
    public func attach(to coordinator: ProjectsCoordinator) {
        self.coordinator = coordinator
        coordinator.setOpener(self)
    }

    /// The frontmost project window, for anything that acts on "the current
    /// project" — menu validation, the scripting bridge.
    public var frontWindowController: ComposableTabsWindowController? {
        if let key = NSApp.keyWindow?.windowController as? ComposableTabsWindowController {
            return key
        }
        return NSApp.orderedWindows
            .compactMap { $0.windowController as? ComposableTabsWindowController }
            .first
    }

    public var openWorkspaces: [ProjectWorkspace] {
        controllers.values.map(\.project)
    }

    public func windowController(for repoID: UUID) -> ComposableTabsWindowController? {
        controllers[repoID]
    }

    // MARK: - ProjectOpening

    public func openProject(_ repo: GitRepo) {
        if let existing = controllers[repo.id] {
            existing.project.update(repo: repo)
            existing.showWindow(nil)
            existing.window?.makeKeyAndOrderFront(nil)
            return
        }
        guard let database = coordinator?.database else {
            Self.logger.error("Cannot open \(repo.name, privacy: .public): no project database attached")
            return
        }
        let workspace = ProjectWorkspace(repo: repo, database: database)
        let controller = ComposableTabsWindowController(project: workspace)
        controllers[repo.id] = controller
        controller.showWindow(nil)
        controller.window?.makeKeyAndOrderFront(nil)
        observeClose(of: controller, repoID: repo.id)
    }

    /// Drops the controller when its window closes, so reopening the project
    /// builds a fresh window rather than resurrecting a closed one.
    private func observeClose(of controller: ComposableTabsWindowController, repoID: UUID) {
        guard let window = controller.window else { return }
        closeObservers[repoID] = NotificationCenter.default.addObserver(
            forName: NSWindow.willCloseNotification,
            object: window,
            queue: .main
        ) { [weak self] _ in
            MainActor.assumeIsolated {
                guard let self else { return }
                self.controllers.removeValue(forKey: repoID)
                if let observer = self.closeObservers.removeValue(forKey: repoID) {
                    NotificationCenter.default.removeObserver(observer)
                }
            }
        }
    }
}

extension ProjectWindowManager: Loggable {
    public static nonisolated let logger = makeLogger()
}
