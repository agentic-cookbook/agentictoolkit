import Foundation

extension ComposableSettings {

    /// The back/forward trail behind the `‹ ›` control in the settings toolbar.
    ///
    /// A value type with no reference to a view, a panel, or AppKit: it records
    /// panel *indices* and answers where the arrows should go. Keeping it free of
    /// the split view is what makes the awkward part — that stepping backwards
    /// must not itself count as a new step — testable without a window.
    public struct SettingsNavigationHistory: Equatable, Sendable {

        /// Every visited panel index, oldest first, including the ones ahead of
        /// the cursor that a forward step would return to.
        private var entries: [Int] = []

        /// Index into `entries` of where the user is now; -1 before anything is
        /// visited.
        private var cursor: Int = -1

        public init() {}

        /// The panel index the user is on, or nil before anything is visited.
        public var current: Int? {
            entries.indices.contains(cursor) ? entries[cursor] : nil
        }

        /// Whether there is somewhere behind the current panel to go back to —
        /// the enabled state of the `‹` segment.
        public var canGoBack: Bool { cursor > 0 }

        /// Whether a back step has left a trail ahead to return along — the
        /// enabled state of the `›` segment.
        public var canGoForward: Bool { cursor >= 0 && cursor < entries.count - 1 }

        /// Notes a panel the user navigated *to*. Re-selecting the panel already
        /// shown is not a step (clicking the selected row would otherwise stack up
        /// entries that all go nowhere), and a new step after going back discards
        /// the forward trail — the branch the user just left is no longer reachable,
        /// exactly as in a browser.
        public mutating func record(_ index: Int) {
            guard current != index else { return }
            if cursor < entries.count - 1 {
                entries.removeSubrange((cursor + 1)...)
            }
            entries.append(index)
            cursor = entries.count - 1
        }

        /// Steps back and returns the panel index to show, or nil at the start of
        /// the trail.
        public mutating func goBack() -> Int? {
            guard canGoBack else { return nil }
            cursor -= 1
            return entries[cursor]
        }

        /// Steps forward and returns the panel index to show, or nil at the end of
        /// the trail.
        public mutating func goForward() -> Int? {
            guard canGoForward else { return nil }
            cursor += 1
            return entries[cursor]
        }

        /// Forgets the whole trail. The indices are positions in the panel list, so
        /// they stop meaning anything the moment that list is replaced.
        public mutating func reset() {
            entries.removeAll()
            cursor = -1
        }
    }
}
