import AppKit
import OSLog
import AgenticToolkitCore

/// Opens a project's window. Injected rather than owned so the registry — the
/// database, the scan, the chooser — does not depend on the window layer, and
/// can be exercised without one (`dependency-injection`).
@MainActor
public protocol ProjectOpening: AnyObject {
    func openProject(_ repo: GitRepo)
}

/// The project registry feature: one database, the list of known git
/// repositories, and the scan that keeps that list true.
///
/// A "project" here is a row, not a file. Nothing about a project lives in the
/// repository's own directory, so a repository can be renamed or moved without
/// losing its settings or its window layout.
@MainActor
public final class ProjectsCoordinator: AppFeature {

    /// Posted after any change to the repository list — a scan finishing, a
    /// rename, a project being opened. Carries no payload: readers ask for
    /// `repos`, which is the one representation of that knowledge (`dry`).
    public static let didChangeNotification = Notification.Name("ProjectsCoordinatorDidChange")

    public let database: ProjectDatabase
    public private(set) var repos: [GitRepo] = []
    public private(set) var isScanning = false
    /// The result of the most recent scan, for anything that wants to show it
    /// after the progress panel has gone.
    public private(set) var lastScanSummary: ProjectScanSummary?

    /// Set only by a test or a host that wants a particular walk. Left `nil`,
    /// each scan builds its own scanner from the current setting, so editing
    /// the skip list takes effect on the next scan rather than the next launch.
    private let injectedScanner: GitRepoScanner?
    private weak var opener: ProjectOpening?
    private var progressWindow: ProjectScanProgressWindow?

    public init(
        database: ProjectDatabase,
        scanner: GitRepoScanner? = nil,
        opener: ProjectOpening? = nil
    ) throws {
        self.database = database
        self.injectedScanner = scanner
        self.opener = opener
        super.init()

        self.repos = (try? database.allRepos()) ?? []

        self.menuContributions = [
            MenuContribution(slot: .file, title: "Open Project…", order: 0, key: "o") { [weak self] in
                self?.showProjectChooser()
            },
            MenuContribution(
                slot: .file,
                title: "Scan for Projects",
                order: 10,
                isHidden: { [weak self] in self?.isScanning ?? false },
                action: { [weak self] in self?.scan() }
            )
        ]
    }

    /// Set once by the host after the window layer exists — the opener and the
    /// registry would otherwise have to be constructed in the same breath.
    public func setOpener(_ opener: ProjectOpening) {
        self.opener = opener
    }

    // MARK: - AppFeature

    /// Launching scans: the registry is only as good as its last look at disk,
    /// and the alternative is an app whose project list is quietly wrong until
    /// someone thinks to refresh it.
    public override func start() throws {
        scan()
    }

    public override func stop() {
        try? database.checkpoint()
    }

    // MARK: - Registry

    public func repo(id: UUID) -> GitRepo? {
        repos.first { $0.id == id }
    }

    /// Renames a project. The name is the user's; a scan never overwrites it.
    public func rename(repoID: UUID, to name: String) {
        guard var repo = repo(id: repoID) else { return }
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, trimmed != repo.name else { return }
        repo.name = trimmed
        do {
            try database.update(repo)
            reload()
        } catch {
            Self.logger.error("Rename failed for \(repoID.uuidString, privacy: .public): \(error)")
        }
    }

    public func openProject(_ repo: GitRepo) {
        do {
            try database.markOpened(id: repo.id)
        } catch {
            Self.logger.error("Could not record open time: \(error)")
        }
        reload()
        opener?.openProject(repo)
    }

    public func showProjectChooser() {
        ProjectChooserWindow.choose(from: self) { [weak self] repo in
            self?.openProject(repo)
        }
    }

    private func reload() {
        repos = (try? database.allRepos()) ?? repos
        NotificationCenter.default.post(name: Self.didChangeNotification, object: self)
    }

    // MARK: - Scanning

    /// Walks the scan roots on a background queue and reconciles the result
    /// into the database. Re-entrant calls are dropped rather than queued: two
    /// scans of the same disk produce the same answer, so the second is waste.
    public func scan(showingProgress: Bool = true) {
        guard !isScanning else { return }
        isScanning = true

        if showingProgress {
            let window = ProjectScanProgressWindow()
            window.present()
            progressWindow = window
        }

        let scanner = injectedScanner
            ?? GitRepoScanner(rootSkipPatterns: UserSettings.projectScanSkipPatterns.currentValue)
        Task.detached(priority: .utility) {
            let found = scanner.scan()
            await MainActor.run { self.finishScan(found: found) }
        }
    }

    private func finishScan(found: [ScannedGitRepo]) {
        let plan = ProjectReconciler.plan(existing: repos, scanned: found)
        do {
            for repo in plan.inserts { try database.insert(repo) }
            for repo in plan.updates { try database.update(repo) }
        } catch {
            Self.logger.error("Could not apply scan results: \(error)")
        }

        lastScanSummary = plan.summary
        isScanning = false
        reload()

        Self.logger.info("Scan complete: \(plan.summary.summaryText, privacy: .public)")
        progressWindow?.finish()
        progressWindow = nil
    }
}

extension ProjectsCoordinator: Loggable {
    public static nonisolated let logger = makeLogger()
}
