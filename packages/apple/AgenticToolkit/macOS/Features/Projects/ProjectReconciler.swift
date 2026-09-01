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
    /// (`principle-of-least-astonishment`). The cost is real and accepted: a
    /// project on an unmounted volume is forgotten and comes back as new.
    public static func plan(
        existing: [GitRepo],
        scanned: [ScannedGitRepo],
        now: Date = Date()
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

        var missing = existing.filter { !seenIDs.contains($0.id) }
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
            let byName = unmatchedScans.filter { candidate in
                !claimed.contains(candidate.path)
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
