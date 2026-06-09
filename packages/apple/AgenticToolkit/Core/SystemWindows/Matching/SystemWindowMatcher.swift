import CoreGraphics
import Foundation
import os.log

/// Creates window fingerprints from live windows using app-specific heuristics,
/// and re-matches windows to context fingerprints after restart.
///
/// SystemWindowMatcher bridges the heuristic system and the fingerprinting model.
/// Given a live window (SystemWindowInfo), it looks up the appropriate heuristic
/// for the owning app, extracts a title pattern, and creates a fingerprint.
///
/// The re-matching engine scores all running windows against all context
/// fingerprints and produces a greedy one-to-one assignment.
public struct SystemWindowMatcher: Loggable {

    public static nonisolated let logger = makeLogger()

    /// Minimum score for a match to be auto-assigned without user confirmation.
    public static let autoAssignThreshold: Int = 80

    /// Minimum pattern length for a substring (non-exact) title match to count.
    /// Prevents a 1-character pattern from matching nearly every window of an app.
    public static let minSubstringPatternLength: Int = 2

    /// The heuristic registry used to look up app-specific heuristics.
    public let registry: HeuristicRegistry

    /// Creates a SystemWindowMatcher with the given registry.
    ///
    /// - Parameter registry: The heuristic registry. Defaults to the shared instance.
    public init(registry: HeuristicRegistry = .shared) {
        self.registry = registry
    }

    // MARK: - Fingerprinting

    /// Creates a fingerprint for a live window.
    ///
    /// If a heuristic is registered for the window's app and successfully
    /// extracts a pattern, the fingerprint uses that pattern and the
    /// heuristic's recommended match strategy.
    ///
    /// If no heuristic is registered, or the heuristic returns nil,
    /// the fingerprint uses the full window title with appAndTitleSubstring
    /// as a fallback strategy.
    ///
    /// - Parameter window: The live window to fingerprint.
    /// - Returns: A fingerprint capturing the window's identity.
    public func fingerprint(window: SystemWindowInfo) -> SystemWindowFingerprint {
        if let heuristic = registry.heuristic(for: window.app),
           let (pattern, strategy) = heuristic.fingerprintPattern(for: window.title) {
            return SystemWindowFingerprint(
                app: window.app,
                titlePattern: pattern,
                matchStrategy: strategy,
                display: window.display
            )
        }

        // Fallback: use the full title as the pattern
        return SystemWindowFingerprint(
            app: window.app,
            titlePattern: window.title,
            matchStrategy: window.title.isEmpty ? .appOnly : .appAndTitleSubstring,
            display: window.display
        )
    }

    // MARK: - Scoring

    /// Scores a single live window against a fingerprint.
    ///
    /// Scoring rules:
    /// - App name must match (case-insensitive). If it doesn't, score is 0.
    /// - Title pattern match based on strategy:
    ///   - `.appAndTitleExact`: exact match = 80 pts, otherwise 0
    ///   - `.appAndTitleSubstring`: exact match = 80 pts, substring = 60 pts, otherwise 0
    ///   - `.appOnly`: no title scoring (just the app match base)
    /// - Display match bonus: +10 if the window is on the same display
    ///
    /// Base score for an app match with `.appOnly` strategy is 80 (ensures it
    /// meets the auto-assign threshold on its own).
    ///
    /// - Parameters:
    ///   - window: The live window to score.
    ///   - fingerprint: The fingerprint to match against.
    /// - Returns: The match score (0 means no match).
    public func score(window: SystemWindowInfo, against fingerprint: SystemWindowFingerprint) -> Int {
        // App name must match (case-insensitive)
        guard window.app.lowercased() == fingerprint.app.lowercased() else {
            return 0
        }

        var score = 0

        switch fingerprint.matchStrategy {
        case .appAndTitleExact:
            // Apply heuristic to extract pattern from the live window title
            let livePattern = extractPattern(from: window)
            if livePattern.lowercased() == fingerprint.titlePattern.lowercased() {
                score += 80
            } else {
                return 0
            }

        case .appAndTitleSubstring:
            let live = extractPattern(from: window).lowercased()
            let pattern = fingerprint.titlePattern.lowercased()
            if live == pattern {
                // Exact pattern match
                score += 80
            } else if Self.substringMatches(
                live: live, pattern: pattern, rawTitle: window.title.lowercased()
            ) {
                // Substring match (guarded by a minimum length so a 1-char pattern
                // doesn't match nearly every window of the app)
                score += 60
            } else {
                return 0
            }

        case .appAndTitleRegex:
            // The fingerprint stores the regex source; a live window matches if its
            // title matches the pattern, so the whole title family re-matches.
            guard Self.regexMatches(pattern: fingerprint.titlePattern, title: window.title) else {
                return 0
            }
            score += 80

        case .appOnly:
            // App-only strategy: app match alone is sufficient
            score += 80
        }

        // Display match bonus
        if window.display == fingerprint.display {
            score += 10
        }

        return score
    }

    // MARK: - Re-matching Engine

    /// Represents a candidate match between a context snapshot and a live window.
    public struct CandidateMatch: Equatable {
        /// The context ID the snapshot belongs to.
        public let contextID: UUID

        /// The snapshot ID within the context.
        public let snapshotID: UUID

        /// The live window that matched.
        public let window: SystemWindowInfo

        /// The match score.
        public let score: Int

        public init(contextID: UUID, snapshotID: UUID, window: SystemWindowInfo, score: Int) {
            self.contextID = contextID
            self.snapshotID = snapshotID
            self.window = window
            self.score = score
        }
    }

    /// The result of running the re-matching engine.
    public struct MatchResult: Equatable {
        /// Pairs where a snapshot was matched to a live window.
        public let matched: [CandidateMatch]

        /// Snapshot identifiers that could not be matched to any live window.
        public let unmatchedSnapshots: [(contextID: UUID, snapshotID: UUID)]

        /// Live windows that were not matched to any snapshot.
        public let unassignedWindows: [SystemWindowInfo]

        public init(
            matched: [CandidateMatch],
            unmatchedSnapshots: [(contextID: UUID, snapshotID: UUID)],
            unassignedWindows: [SystemWindowInfo]
        ) {
            self.matched = matched
            self.unmatchedSnapshots = unmatchedSnapshots
            self.unassignedWindows = unassignedWindows
        }

        public static func == (lhs: MatchResult, rhs: MatchResult) -> Bool {
            lhs.matched == rhs.matched
            && lhs.unassignedWindows == rhs.unassignedWindows
            && lhs.unmatchedSnapshots.count == rhs.unmatchedSnapshots.count
            && zip(lhs.unmatchedSnapshots, rhs.unmatchedSnapshots).allSatisfy {
                $0.contextID == $1.contextID && $0.snapshotID == $1.snapshotID
            }
        }
    }

    /// Scores all running windows against all dormant context fingerprints
    /// and produces a greedy one-to-one assignment.
    ///
    /// Only dormant snapshots (windowID == nil) are considered for re-matching.
    /// Live windows already assigned to a context are excluded.
    ///
    /// - Parameters:
    ///   - contexts: All contexts with their window snapshots.
    ///   - liveWindows: All currently running windows.
    /// - Returns: A MatchResult with matched pairs, unmatched snapshots, and unassigned windows.
    public func matchWindows(
        contexts: [SystemWindowContext],
        liveWindows: [SystemWindowInfo],
        threshold: Int = autoAssignThreshold
    ) -> MatchResult {
        // Collect all dormant snapshots (no live windowID)
        var dormantSnapshots: [(contextID: UUID, snapshot: SystemWindowSnapshot)] = []
        var assignedWindowIDs: Set<UInt32> = []

        for context in contexts {
            for snapshot in context.windowSnapshots {
                if let windowID = snapshot.windowID {
                    // This snapshot has a live window — track it as assigned
                    assignedWindowIDs.insert(windowID)
                } else {
                    // Dormant snapshot — candidate for re-matching
                    dormantSnapshots.append((contextID: context.id, snapshot: snapshot))
                }
            }
        }

        // Filter live windows: exclude those already assigned to a context
        let candidateWindows = liveWindows.filter { !assignedWindowIDs.contains($0.id) }

        // Build all candidate matches
        var candidates: [CandidateMatch] = []

        for (contextID, snapshot) in dormantSnapshots {
            for window in candidateWindows {
                let matchScore = score(window: window, against: snapshot.fingerprint)
                // Only auto-assignable matches consume snapshots/windows. Sub-threshold
                // pairs are intentionally left out so their snapshot and window remain in
                // unmatchedSnapshots / unassignedWindows for manual handling.
                if matchScore >= threshold {
                    candidates.append(CandidateMatch(
                        contextID: contextID,
                        snapshotID: snapshot.id,
                        window: window,
                        score: matchScore
                    ))
                }
            }
        }

        // Sort by score descending, with deterministic tie-breakers: Array.sort is not
        // guaranteed stable, so equal scores need a fixed order for reproducible greedy
        // assignment across runs.
        candidates.sort { lhs, rhs in
            if lhs.score != rhs.score { return lhs.score > rhs.score }
            if lhs.contextID != rhs.contextID {
                return lhs.contextID.uuidString < rhs.contextID.uuidString
            }
            if lhs.snapshotID != rhs.snapshotID {
                return lhs.snapshotID.uuidString < rhs.snapshotID.uuidString
            }
            return lhs.window.id < rhs.window.id
        }

        // Greedy one-to-one assignment
        var assignedSnapshotIDs: Set<UUID> = []
        var assignedCandidateWindowIDs: Set<UInt32> = []
        var matched: [CandidateMatch] = []

        for candidate in candidates {
            // Skip if this snapshot or window is already assigned
            if assignedSnapshotIDs.contains(candidate.snapshotID) { continue }
            if assignedCandidateWindowIDs.contains(candidate.window.id) { continue }

            matched.append(candidate)
            assignedSnapshotIDs.insert(candidate.snapshotID)
            assignedCandidateWindowIDs.insert(candidate.window.id)
        }

        // Compute unmatched snapshots
        let unmatchedSnapshots = dormantSnapshots
            .filter { !assignedSnapshotIDs.contains($0.snapshot.id) }
            .map { (contextID: $0.contextID, snapshotID: $0.snapshot.id) }

        // Compute unassigned windows
        let unassignedWindows = candidateWindows
            .filter { !assignedCandidateWindowIDs.contains($0.id) }

        return MatchResult(
            matched: matched,
            unmatchedSnapshots: unmatchedSnapshots,
            unassignedWindows: unassignedWindows
        )
    }

    // MARK: - Private Helpers

    /// Extracts the title pattern from a live window using the heuristic system.
    ///
    /// This mirrors the fingerprinting logic: if a heuristic exists for the app,
    /// use it to extract a pattern; otherwise use the raw title.
    private func extractPattern(from window: SystemWindowInfo) -> String {
        if let heuristic = registry.heuristic(for: window.app),
           let pattern = heuristic.extractPattern(from: window.title) {
            return pattern
        }
        return window.title
    }

    /// Whether the live window's (extracted or raw) title contains the stored pattern,
    /// guarded by a minimum length so very short patterns don't over-match. All inputs
    /// are lowercased. The reverse direction — a long stored pattern *containing* a short
    /// live token — was dropped: it admitted unrelated windows as 60-pt matches.
    private static func substringMatches(live: String, pattern: String, rawTitle: String) -> Bool {
        let minLen = minSubstringPatternLength
        guard pattern.count >= minLen else { return false }
        return live.contains(pattern) || rawTitle.contains(pattern)
    }

    /// Whether `title` matches the case-insensitive regex `pattern`.
    ///
    /// Requires a non-empty match: a zero-width pattern (`.*`, `^`, `\b`, `a?`, …) would
    /// otherwise match every title. An invalid pattern is logged rather than silently
    /// swallowed, so a corrupt/uncompilable fingerprint isn't mistaken for "no match"
    /// and the window orphaned forever.
    private static func regexMatches(pattern: String, title: String) -> Bool {
        guard !pattern.isEmpty else { return false }
        let regex: NSRegularExpression
        do {
            regex = try NSRegularExpression(pattern: pattern, options: [.caseInsensitive])
        } catch {
            logger.error(
                "Invalid title regex '\(pattern, privacy: .public)': \(error.localizedDescription, privacy: .public)"
            )
            return false
        }
        let range = NSRange(title.startIndex..<title.endIndex, in: title)
        guard let match = regex.firstMatch(in: title, options: [], range: range) else { return false }
        return match.range.length > 0
    }
}
