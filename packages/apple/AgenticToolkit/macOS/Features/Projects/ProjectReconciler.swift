import Foundation

/// Turns "what is on disk" plus "what we already knew" into the rows to write.
///
/// Pure and `nonisolated` so the interesting half of scanning — did this
/// repository move, or is it a different one? — can be tested without a
/// database, a filesystem or a main actor (`tight-feedback-loops`).
public enum ProjectReconciler {

    public struct Plan: Sendable {
        public var inserts: [GitRepo] = []
        public var updates: [GitRepo] = []
        public var deletes: [GitRepo] = []
        public var summary = ProjectScanSummary()
    }

    /// Matches scan results against known repositories.
    ///
    /// A repository whose path is gone is looked for elsewhere before it is
    /// written off: first by remote (two checkouts of the same remote are the
    /// same project moved, in the overwhelming case), then by directory name.
    /// A match has to be unique — two candidates means the answer is a guess,
    /// and a guess here silently re-points a project's settings at the wrong
    /// folder, so the row is deleted instead.
    ///
    /// A repository the scan does not account for is **deleted**, with its
    /// settings and layout. The registry is a picture of what is on disk now,
    /// and a list padded with projects that are not there is a list nobody can
    /// use — the browser would have to show rows that cannot be opened
    /// (`principle-of-least-astonishment`).
    ///
    /// "Does not account for" is checked against disk, not against the scan
    /// alone. A row the scan missed whose path is still a git repository was
    /// not lost, it was not looked at: the user added a skip pattern, a parent
    /// directory turned unreadable, a scan root moved. Deleting on that
    /// evidence cascades the project's settings, layout, tabs, pane state and
    /// window frame away with no undo, so such a row is left where it is —
    /// counted as skipped, and kept out of the move pass, which would otherwise
    /// re-point it at whatever else happens to share its name.
    ///
    /// The cost is still real and accepted for a genuinely absent path: a
    /// project on an unmounted volume is forgotten and comes back as new.
    public static func plan(
        existing: [GitRepo],
        scanned: [ScannedGitRepo],
        now: Date = Date(),
        isStillARepository: (String) -> Bool = ProjectReconciler.repositoryExists
    ) -> Plan {
        var plan = Plan()
        var byPath: [String: GitRepo] = [:]
        for repo in existing { byPath[repo.path] = repo }

        var unmatchedScans: [ScannedGitRepo] = []
        var seenIDs = Set<UUID>()

        for scan in scanned {
            guard var known = byPath[scan.path] else {
                unmatchedScans.append(scan)
                continue
            }
            seenIDs.insert(known.id)
            if known.remote != scan.remote {
                known.remote = scan.remote
                known.lastSeen = now
                plan.updates.append(known)
            }
            plan.summary.unchanged += 1
        }

        // Rows the scan did not report. The ones whose path is still a git
        // repository were not looked at rather than lost — they are held back
        // from both the move pass and the delete pass (see the note above).
        var missing = existing.filter { !seenIDs.contains($0.id) }
        let skippedCount = missing.count
        missing.removeAll { isStillARepository($0.path) }
        plan.summary.skipped = skippedCount - missing.count

        var claimed = Set<String>()

        // Moves first: a moved repository must claim its new path before the
        // adoption pass below turns that same path into a brand-new project.
        for index in missing.indices {
            let candidates = unmatchedScans.filter { candidate in
                guard !claimed.contains(candidate.path) else { return false }
                if let remote = missing[index].remote, let other = candidate.remote, !remote.isEmpty {
                    return remote == other
                }
                return false
            }
            // A name is only evidence when there is no remote on either side to
            // disagree about. `~/work/api` and `~/scratch/api` are two different
            // projects that share a leaf name, and re-pointing one at the other
            // hands its settings and layout to a stranger — the outcome the
            // uniqueness rule above exists to prevent. Repositories with remotes
            // are already matched by the pass above, on evidence that means
            // something.
            let byName = unmatchedScans.filter { candidate in
                !claimed.contains(candidate.path)
                    && (missing[index].remote ?? "").isEmpty
                    && (candidate.remote ?? "").isEmpty
                    && candidate.leafName == GitRepo.defaultName(forPath: missing[index].path)
            }
            let match = candidates.count == 1 ? candidates.first : (byName.count == 1 ? byName.first : nil)
            guard let match else { continue }
            claimed.insert(match.path)
            var moved = missing[index]
            moved.path = match.path
            moved.remote = match.remote
            moved.lastSeen = now
            plan.updates.append(moved)
            plan.summary.moved += 1
            seenIDs.insert(moved.id)
        }
        missing.removeAll { seenIDs.contains($0.id) }

        // Whatever is still unclaimed is new.
        var takenNames = Set(existing.map(\.name))
        for scan in unmatchedScans where !claimed.contains(scan.path) {
            let name = uniqueName(forPath: scan.path, taken: takenNames)
            takenNames.insert(name)
            plan.inserts.append(GitRepo(
                path: scan.path,
                name: name,
                remote: scan.remote,
                firstSeen: now,
                lastSeen: now
            ))
            plan.summary.added += 1
        }

        // And whatever is still unaccounted for is gone.
        plan.deletes = missing
        plan.summary.removed = missing.count

        return plan
    }

    /// Whether `path` still holds a git repository.
    ///
    /// `.git` is a directory in an ordinary checkout and a file in a worktree
    /// or a submodule, so its existence is the whole test. Injected into
    /// `plan(existing:scanned:now:isStillARepository:)` rather than called from
    /// it, so the reconciler stays pure and testable without a filesystem
    /// (`dependency-injection`).
    public static func repositoryExists(atPath path: String) -> Bool {
        FileManager.default.fileExists(atPath: (path as NSString).appendingPathComponent(".git"))
    }

    /// The directory name, qualified with as many parent segments as it takes
    /// to be unique — the same rule `proj projects` uses, so a project has the
    /// same name in both tools. Only a default: the name is the user's to change.
    public static func uniqueName(forPath path: String, taken: Set<String>) -> String {
        let components = URL(fileURLWithPath: path).pathComponents.filter { $0 != "/" }
        guard !components.isEmpty else { return path }
        for count in 1...components.count {
            let candidate = components.suffix(count).joined(separator: "/")
            if !taken.contains(candidate) { return candidate }
        }
        return path
    }
}
