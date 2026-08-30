import Foundation

/// What the project filter matches, and where in the text it matched.
///
/// Both answers come from here, so the characters a row highlights can never
/// disagree with the reason that row survived the filter (`dry`).
public enum ProjectFilter {

    /// Every case-insensitive occurrence of `query` in `text`.
    ///
    /// Ranges are into the UTF-16 view because that is what an attributed
    /// string indexes by; `String.Index` would have to be converted at every
    /// call site to be of any use here.
    public static func ranges(of query: String, in text: String) -> [NSRange] {
        guard !query.isEmpty else { return [] }
        let haystack = text as NSString
        var found: [NSRange] = []
        var start = 0
        while start < haystack.length {
            let remaining = NSRange(location: start, length: haystack.length - start)
            let match = haystack.range(of: query, options: [.caseInsensitive], range: remaining)
            guard match.location != NSNotFound else { break }
            found.append(match)
            // `max(_, 1)` because a query that matched an empty extent would
            // otherwise leave `start` where it was and loop forever.
            start = match.location + max(match.length, 1)
        }
        return found
    }

    /// A project matches when the query appears in what it is called or in
    /// where it is kept — the two things someone remembers about a project.
    /// An empty query matches everything, which is what an unfiltered list is.
    public static func matches(_ repo: GitRepo, query: String) -> Bool {
        guard !query.isEmpty else { return true }
        return !ranges(of: query, in: repo.name).isEmpty
            || !ranges(of: query, in: repo.path).isEmpty
    }
}
