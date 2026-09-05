import AppKit

extension ComposableSettings {

    /// What the sidebar's search field matches against.
    ///
    /// A panel is more than its name — "Launch at login" lives under *General*
    /// and "Cursor blink" under *Terminal*, and typing either should find the
    /// panel that holds it. So a panel's searchable text is its title, its
    /// section, its help prose, the keywords it declares, and — for a panel
    /// that has already been opened — the words its own controls are labelled
    /// with, read off the built view tree.
    ///
    /// **It never builds a panel to look inside it.** Harvesting used to force
    /// every panel's view to load on the first keystroke, which is precisely the
    /// work lazy panels exist to avoid, and it ran each one's side effects (file
    /// scans, server probes) for a reader who had typed a single letter. A panel
    /// that wants to be findable before it is first opened says so with
    /// `searchKeywords`; anything it puts on screen is matched from then on.
    ///
    /// Nothing is cached. The text is re-read per panel per keystroke over a
    /// handful of already-built view trees, which costs less than the bugs a
    /// cache bought: a stale entry outlived the panel whose controls it
    /// described, and there was no invalidation hook a nested split could reach.
    @MainActor
    public final class SettingsSearchIndex {

        public init() {}

        /// True when `panel` should stay in the sidebar for `query`. A blank
        /// query matches everything, so clearing the field restores the full list.
        public func matches(_ panel: any ComposableSettingsPanel, query: String) -> Bool {
            let needle = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            guard !needle.isEmpty else { return true }
            let haystack = Self.harvest(from: panel).joined(separator: "\n").lowercased()
            // Each whitespace-separated word must appear, so "term font" narrows
            // rather than widens — the behaviour every search field on the system has.
            return needle.split(separator: " ").allSatisfy { haystack.contains($0) }
        }

        // MARK: - Harvesting

        private static func harvest(from panel: any ComposableSettingsPanel) -> [String] {
            var terms = [panel.descriptor.title]
            if let section = panel.descriptor.section {
                terms.append(section)
            }
            terms.append(contentsOf: panel.searchKeywords)
            for topic in panel.helpContent?.topics ?? [] {
                terms.append(topic.title)
                terms.append(topic.body)
            }
            // A nested split's own view holds only a sidebar; the settings the
            // reader is searching for are in the panels it hosts. Recurse into
            // the ones it has — but only if it has loaded, since a split
            // populates `panels` in `viewDidLoad`.
            if let split = panel as? SplitViewController {
                guard split.isViewLoaded else { return terms }
                for child in split.panels {
                    terms.append(contentsOf: harvest(from: child))
                }
                return terms
            }
            guard panel.isViewLoaded else { return terms }
            terms.append(contentsOf: labels(in: panel.view))
            return terms
        }

        /// Every word the panel puts on screen as a name: static labels, button
        /// and checkbox titles, and the choices inside a popup. Editable fields
        /// are skipped — their contents are the user's data, not the setting's name.
        private static func labels(in view: NSView) -> [String] {
            var terms: [String] = []
            switch view {
            case let field as NSTextField where !field.isEditable:
                terms.append(field.stringValue)
            case let popUp as NSPopUpButton:
                terms.append(contentsOf: popUp.itemTitles)
            case let button as NSButton:
                terms.append(button.title)
            default:
                break
            }
            for subview in view.subviews {
                terms.append(contentsOf: labels(in: subview))
            }
            return terms
        }
    }
}
