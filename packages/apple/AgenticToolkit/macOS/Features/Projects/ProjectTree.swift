import Foundation

/// The registry arranged the way it sits on disk: the folders that lead to
/// projects, and the projects themselves.
///
/// A flat list made every row carry its own path, so working out what lived
/// where meant reading four hundred of them. Under the folders that hold them
/// the same rows say it once, in the shape the user already has in their head
/// (`principle-of-least-astonishment`).
@MainActor
public final class ProjectTreeNode {

    /// What the row is called: one path component for a folder, the project's
    /// own name for a project.
    public let name: String

    /// The project this row stands for, or `nil` on a folder — a folder here is
    /// a directory on the way to a project, never a project itself.
    public let repo: GitRepo?

    /// The absolute path this row stands for. A folder's is what makes it
    /// unique when two trees hold folders of the same name.
    public let path: String

    public private(set) var children: [ProjectTreeNode] = []

    public var isFolder: Bool { repo == nil }

    fileprivate init(name: String, path: String, repo: GitRepo?) {
        self.name = name
        self.path = path
        self.repo = repo
    }

    fileprivate func add(_ child: ProjectTreeNode) {
        children.append(child)
    }

    /// Folders first, then projects, each alphabetically — the file browser's
    /// order, because this is meant to read as the same kind of list (`dry`).
    fileprivate func sortRecursively() {
        children.sort { lhs, rhs in
            if lhs.isFolder != rhs.isFolder { return lhs.isFolder }
            return lhs.name.localizedCaseInsensitiveCompare(rhs.name) == .orderedAscending
        }
        children.forEach { $0.sortRecursively() }
    }

    /// Every project at or under this node, in display order. What the chooser
    /// uses to put the selection on a project rather than a folder.
    public var repositoriesInDisplayOrder: [ProjectTreeNode] {
        if repo != nil { return [self] }
        return children.flatMap { $0.repositoriesInDisplayOrder }
    }
}

/// Builds the tree. Its own type so the shape is testable without a window.
public enum ProjectTree {

    /// Arranges `repos` under their containing folders.
    ///
    /// Paths inside the home directory are shown relative to it, so the top of
    /// the list is `Development` and `Deployments` rather than three levels of
    /// `Users/<name>` that are the same for everything. Paths outside it keep
    /// their leading slash, which is the only thing distinguishing `/opt` from
    /// a folder of the user's called `opt`.
    @MainActor
    public static func build(
        from repos: [GitRepo],
        homeDirectory: URL = FileManager.default.homeDirectoryForCurrentUser
    ) -> [ProjectTreeNode] {
        let home = standardized(homeDirectory.path)
        var roots: [ProjectTreeNode] = []
        var byPath: [String: ProjectTreeNode] = [:]

        for repo in repos {
            let trail = Self.trail(for: standardized(repo.path), home: home)
            guard let leaf = trail.last else { continue }

            var parent: ProjectTreeNode?
            for step in trail.dropLast() {
                if let existing = byPath[step.path] {
                    parent = existing
                    continue
                }
                let folder = ProjectTreeNode(name: step.name, path: step.path, repo: nil)
                byPath[step.path] = folder
                if let parent { parent.add(folder) } else { roots.append(folder) }
                parent = folder
            }

            // A project already in the tree is a folder that turned out to be
            // one — two registry rows for one path, which the registry allows
            // and this must not duplicate (`idempotency`).
            if let existing = byPath[leaf.path], existing.repo != nil { continue }
            let node = ProjectTreeNode(name: repo.name, path: leaf.path, repo: repo)
            byPath[leaf.path] = node
            if let parent { parent.add(node) } else { roots.append(node) }
        }

        roots.sort { lhs, rhs in
            if lhs.isFolder != rhs.isFolder { return lhs.isFolder }
            return lhs.name.localizedCaseInsensitiveCompare(rhs.name) == .orderedAscending
        }
        roots.forEach { $0.sortRecursively() }
        return roots
    }

    /// The rows a path passes through, outermost first, each with the absolute
    /// path that identifies it.
    private static func trail(for path: String, home: String) -> [(path: String, name: String)] {
        let parts = path.split(separator: "/").map(String.init)
        guard !parts.isEmpty else { return [] }

        let homeParts = home.split(separator: "/").map(String.init)
        let underHome = parts.count > homeParts.count && Array(parts.prefix(homeParts.count)) == homeParts
        let start = underHome ? homeParts.count : 0

        var trail: [(path: String, name: String)] = []
        for index in start..<parts.count {
            let absolute = "/" + parts[0...index].joined(separator: "/")
            // Only an absolute path's own first row wears the slash: further
            // down, a leading slash would be decoration.
            let name = (index == 0 && !underHome) ? "/" + parts[index] : parts[index]
            trail.append((path: absolute, name: name))
        }
        return trail
    }

    private static func standardized(_ path: String) -> String {
        path.count > 1 && path.hasSuffix("/") ? String(path.dropLast()) : path
    }
}
