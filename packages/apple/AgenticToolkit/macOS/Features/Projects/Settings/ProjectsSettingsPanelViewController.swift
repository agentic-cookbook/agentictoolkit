import AppKit

import AgenticToolkitCore

/// Settings for project windows: how much room the panes are given, how a pane
/// shows it is the active one, and what the project scan skips.
///
/// Built from the shared `ComposableSettings` vocabulary, like every other
/// panel in this window. It used to host a SwiftUI view instead, which made it
/// the one topic whose rows sat at different heights, in different fonts, with
/// controls the theme reached differently (`consistency`).
///
/// Each skip row says which of the user's own folders the pattern currently
/// excludes, because a glob with nothing behind it looks identical to a glob
/// that is quietly hiding half their work (`explicit-over-implicit`).
@MainActor
public final class ProjectsSettingsPanelViewController: ComposableSettings.SettingsPanelViewController {

    /// The list of skipped folders, rebuilt in place whenever the setting
    /// changes — a `GroupView` adds subviews and never removes them, so the
    /// part that comes and goes is one stack the group holds.
    private let patternList = NSStackView()

    /// Held so the panel can join their Tab orders end to end — see
    /// `joinTabOrder()`.
    private var frameSpacing: SpacingControl?
    private var dividerSpacing: SpacingControl?

    private let newPatternField = ThemedTextField()
    private let addButton = NSButton(title: "Add", target: nil, action: nil)
    private let restoreButton = NSButton(title: "Restore Defaults", target: nil, action: nil)

    private var patternsObserver: UserSettingObserver<[String]>?

    /// The visible folders of the home directory — the only things a root-only
    /// pattern can ever match. Read once: the panel is not a file browser, and
    /// a scan on every keystroke would be a disk hit per character.
    ///
    /// Empty until the read lands, and the read happens off the main thread.
    /// This panel is constructed while the app is still launching, and listing
    /// the home directory is a directory read plus a stat per entry — cheap on
    /// a warm local disk, and not cheap at all on a cold one or a network home
    /// directory, where it would be the launch that waited for it.
    private var homeFolders: [String] = []

    /// Whether `homeFolders` is an answer or just its starting value. The two
    /// are indistinguishable otherwise — an empty list is also what a home
    /// directory of nothing but files returns — and they say opposite things
    /// to the user about what a pattern matches.
    private var homeFoldersLoaded = false

    private var patterns: [String] { UserSettings.projectScanSkipPatterns.currentValue }

    public init() {
        super.init(with: ComposableSettings.SettingsPanelDescriptor(
            title: "Projects",
            icon: NSImage(systemSymbolName: "folder.badge.gearshape", accessibilityDescription: nil)
        ))
    }

    public required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    public override var helpContent: ComposableSettings.PanelHelp? {
        ComposableSettings.PanelHelp(topics: [
            .init(
                title: "Frame Spacing",
                body: "The room between the panes and the tab bars framing them, in points, "
                    + "set per side. Each number straddles the edge it belongs to, with an "
                    + "arrow either side of it. Every arrow stands against that edge and "
                    + "points the way it travels, so the arrow pointing into the view is "
                    + "the one that adds space. Hold an arrow down to "
                    + "keep going, or type a number and press Return. Up and down arrows "
                    + "adjust the field you are in."
            ),
            .init(
                title: "Pane Divider Spacing",
                body: "The gaps between panes: one number for panes side by side, one for "
                    + "panes stacked, each sitting on the divider it opens. The arrows "
                    + "pointing at the divider close the gap; the ones pointing away open "
                    + "it. Each number is the whole gap, not each pane's half — ten means "
                    + "ten points between two panes. A gap of zero still drags: the divider "
                    + "keeps a few points of grab area whatever it is drawn at. Spacing "
                    + "belongs to the app, so every project window is spaced the same way."
            ),
            .init(
                title: "Active Pane",
                body: "A project window is split into panes, and one of them is the one you "
                    + "are working in. With this on, that pane is drawn with a border in a "
                    + "tone one step lighter than the others — enough to find it, not enough "
                    + "to compete with what is inside it."
            ),
            .init(
                title: "Active Pane Follows the Mouse",
                body: "With this on, the pane under the pointer becomes the active one as "
                    + "soon as the pointer is over it, and the keyboard goes with it — so a "
                    + "window that is already in front can be typed into without clicking "
                    + "first. Only the front window follows the pointer: passing over a "
                    + "window behind it changes nothing, because that window is not the one "
                    + "taking the keys. The keys land where a click at that spot would have "
                    + "put them, which is the terminal, the list or the field the pointer is "
                    + "actually over rather than the pane as a whole. Off, the active pane "
                    + "is the one you last clicked in."
            ),
            .init(
                title: "Themes Override This",
                body: "A theme can carry its own answer for whether the active pane is "
                    + "outlined, and in what color, under the theme's Project topic in Theme "
                    + "settings. When it does, the theme wins over the switch here. A theme "
                    + "has no project options until you set them."
            ),
            .init(
                title: "Skipped Folders",
                body: "Folders in your home directory that the project scan never looks "
                    + "inside. Names match without regard to case, and `*` stands for any run "
                    + "of characters — `* Dropbox` covers `Acme Dropbox`. Only the home "
                    + "directory's own folders can match: these are root-level patterns, not "
                    + "a filter applied at every level of the walk."
            ),
            .init(
                title: "What a Pattern Excludes",
                body: "Each row names the folders it currently matches, so a pattern that "
                    + "has quietly stopped matching anything — a folder renamed, a drive "
                    + "unmounted — is visible instead of looking identical to one that is "
                    + "hiding half your work."
            )
        ])
    }

    public override func viewDidLoad() {
        super.viewDidLoad()

        addGroup(createFrameGroup())
        addGroup(createDividerGroup())
        addGroup(createActivePaneGroup())
        addGroup(createSkippedFoldersGroup())
        joinTabOrder()

        patternsObserver = UserSettingObserver(UserSettings.projectScanSkipPatterns) { [weak self] _ in
            self?.reloadPatterns()
        }
        reloadPatterns()
        loadHomeFolders()
    }

    /// Reads the home directory off the main thread, then redraws the rows so
    /// each pattern's caption swaps from "still looking" to what it matches.
    private func loadHomeFolders() {
        Task { [weak self] in
            let names = await Task.detached(priority: .utility) {
                ProjectsSettingsPanelViewController.homeFolderNames()
            }.value
            guard let self else { return }
            self.homeFolders = names
            self.homeFoldersLoaded = true
            self.reloadPatterns()
        }
    }

    // MARK: - Groups

    /// The same two pictures the project window's own Spacing sheet shows,
    /// bound to the same app-wide keys — one pair of controls, two places they
    /// are reachable from.
    ///
    /// Two groups rather than one, because they answer two questions: how much
    /// room around the panes, and how much room between them. One diagram
    /// carrying both put six numbers on one picture and made the reader work
    /// out which four were the outside.
    private func createFrameGroup() -> ComposableSettings.GroupView {
        let group = ComposableSettings.GroupView(withTitle: "Frame Spacing")
        let control = SpacingControl.boundToSettings(style: .frame, edges: PaneSpacing.edgeSettings)
        frameSpacing = control
        group.addSettingSubview(control)
        return group
    }

    private func createDividerGroup() -> ComposableSettings.GroupView {
        let group = ComposableSettings.GroupView(withTitle: "Pane Divider Spacing")
        let control = SpacingControl.boundToSettings(
            style: .paneDividers,
            gutters: PaneSpacing.gutterSettings
        )
        dividerSpacing = control
        group.addSettingSubview(control)
        return group
    }

    /// Tab out of the last number in one group and into the first number of the
    /// next, then on into the panel's own field.
    ///
    /// Each control answers Tab within itself and hands the key back at either
    /// end, which is where AppKit takes over — and AppKit works the key view
    /// loop out from where subviews *are*. These are placed by frame, so left
    /// to itself Tab out of the bottom number went somewhere that looked like
    /// nowhere. Which control follows which is the panel's knowledge, so the
    /// panel is what says it. `nextKeyView` sets the back link too, so
    /// Shift-Tab walks the same chain the other way.
    private func joinTabOrder() {
        frameSpacing?.lastNumberField?.nextKeyView = dividerSpacing?.firstNumberField
        dividerSpacing?.lastNumberField?.nextKeyView = newPatternField
    }

    private func createActivePaneGroup() -> ComposableSettings.GroupView {
        let group = ComposableSettings.GroupView(withTitle: "Active Pane")
        group.addSettingSubview(ComposableSettings.CheckboxView(with: ComposableSettings.ViewModel<Bool>(
            title: "Outline the active pane",
            setting: UserSettings.highlightActivePane
        )))
        group.addSettingSubview(ComposableSettings.CheckboxView(with: ComposableSettings.ViewModel<Bool>(
            title: "Active pane follows the mouse",
            setting: UserSettings.activePaneFollowsMouse
        )))
        return group
    }

    private func createSkippedFoldersGroup() -> ComposableSettings.GroupView {
        let group = ComposableSettings.GroupView(withTitle: "Skipped Folders")

        newPatternField.placeholderString = "Folder name or pattern"
        newPatternField.delegate = self
        newPatternField.target = self
        newPatternField.action = #selector(addPattern(_:))
        newPatternField.accessibilityID("settings.projects.skip-pattern-field")
        newPatternField.widthAnchor.constraint(equalToConstant: 240).isActive = true

        addButton.image = NSImage(systemSymbolName: "plus", accessibilityDescription: nil)
        addButton.imagePosition = .imageLeading
        addButton.bezelStyle = .rounded
        addButton.target = self
        addButton.action = #selector(addPattern(_:))
        addButton.accessibilityID("settings.projects.add-skip-pattern")

        restoreButton.bezelStyle = .rounded
        restoreButton.target = self
        restoreButton.action = #selector(restoreDefaults(_:))
        restoreButton.accessibilityID("settings.projects.restore-skip-patterns")

        let controls = ComposableSettings.HorizontalStackView()
        controls.addArrangedSubview(newPatternField)
        controls.addArrangedSubview(addButton)
        controls.addArrangedSubview(restoreButton)
        group.addSettingSubview(controls)

        patternList.orientation = .vertical
        patternList.alignment = .leading
        patternList.spacing = 8
        patternList.translatesAutoresizingMaskIntoConstraints = false
        patternList.accessibilityID("settings.projects.skip-patterns")
        group.addSettingSubview(patternList)

        return group
    }

    // MARK: - The list

    private func reloadPatterns() {
        for row in patternList.arrangedSubviews {
            patternList.removeArrangedSubview(row)
            row.removeFromSuperview()
        }

        let current = patterns
        if current.isEmpty {
            patternList.addArrangedSubview(
                ComposableSettings.ExplanationView(withText: "Nothing is being skipped.")
            )
        } else {
            for pattern in current {
                patternList.addArrangedSubview(makeRow(for: pattern))
            }
        }

        updateButtons()
    }

    private func makeRow(for pattern: String) -> NSView {
        let remove = NSButton(
            image: NSImage(systemSymbolName: "minus.circle", accessibilityDescription: "Remove") ?? NSImage(),
            target: self,
            action: #selector(removePattern(_:))
        )
        remove.isBordered = false
        // The pattern itself, not its row number. A row number is read when the
        // button is pressed and written when the list was last drawn, and those
        // are different lists the moment anything else edits the setting — the
        // button would then remove whatever pattern had moved into its old slot.
        remove.identifier = NSUserInterfaceItemIdentifier(pattern)
        remove.toolTip = "Stop skipping folders matching \(pattern)"
        remove.accessibilityID("settings.projects.remove-skip-pattern.\(pattern)")
        remove.observeTheme { button, palette in
            button.contentTintColor = palette.nsColor(.secondaryText)
        }

        let name = ThemedLabel(string: pattern, role: .primaryText, textRole: .body)
        let caption = ThemedLabel(
            string: matchDescription(for: pattern),
            role: .secondaryText,
            textRole: .caption
        )

        let text = NSStackView(views: [name, caption])
        text.orientation = .vertical
        text.alignment = .leading
        text.spacing = 2

        let row = NSStackView(views: [remove, text])
        row.orientation = .horizontal
        row.alignment = .firstBaseline
        row.spacing = 6
        return row
    }

    private func updateButtons() {
        let typed = trimmedNewPattern
        addButton.isEnabled = !typed.isEmpty && !patterns.contains(typed)
        restoreButton.isEnabled = patterns != GitRepoScanner.defaultRootSkipPatterns
    }

    // MARK: - Editing

    private var trimmedNewPattern: String {
        newPatternField.stringValue.trimmingCharacters(in: .whitespaces)
    }

    @objc private func addPattern(_ sender: Any?) {
        let pattern = trimmedNewPattern
        guard !pattern.isEmpty, !patterns.contains(pattern) else { return }
        newPatternField.stringValue = ""
        store(patterns + [pattern])
    }

    @objc private func removePattern(_ sender: NSButton) {
        guard let pattern = sender.identifier?.rawValue else { return }
        var current = patterns
        // One occurrence, the one this row stands for. Filtering by equality
        // would take every copy, so a list that somehow held a duplicate would
        // lose both rows to one click.
        guard let index = current.firstIndex(of: pattern) else { return }
        current.remove(at: index)
        store(current)
    }

    @objc private func restoreDefaults(_ sender: Any?) {
        store(GitRepoScanner.defaultRootSkipPatterns)
    }

    /// One write, to the one place this list lives. The observer installed in
    /// `viewDidLoad` is what redraws the rows, so a change made here and a
    /// change made anywhere else take the identical path (`dry`).
    private func store(_ newPatterns: [String]) {
        UserSettings.projectScanSkipPatterns.value = newPatterns
    }

    // MARK: - What a pattern actually excludes

    private func matchDescription(for pattern: String) -> String {
        guard homeFoldersLoaded else { return "Checking which of your folders this matches…" }
        let matched = homeFolders.filter { GitRepoScanner.name($0, matches: pattern) }
        switch matched.count {
        case 0:
            return "No folder in your home directory matches this."
        case 1 where matched[0] == pattern:
            return "Skipping ~/\(pattern)"
        default:
            return "Skipping " + matched.map { "~/\($0)" }.joined(separator: ", ")
        }
    }

    /// `nonisolated` so the read above can run off the main actor — the whole
    /// point of doing it there.
    nonisolated private static func homeFolderNames() -> [String] {
        let home = FileManager.default.homeDirectoryForCurrentUser
        let contents = (try? FileManager.default.contentsOfDirectory(
            at: home,
            includingPropertiesForKeys: [.isDirectoryKey],
            options: [.skipsHiddenFiles]
        )) ?? []
        return contents
            .filter { (try? $0.resourceValues(forKeys: [.isDirectoryKey]))?.isDirectory == true }
            .map { $0.lastPathComponent }
            .sorted { $0.localizedCaseInsensitiveCompare($1) == .orderedAscending }
    }
}

extension ProjectsSettingsPanelViewController: NSTextFieldDelegate {

    /// "Add" is only live for a pattern that would actually change the list, so
    /// the enabled state has to follow the field as it is typed in, not only
    /// when it is committed.
    public func controlTextDidChange(_ obj: Notification) {
        updateButtons()
    }
}
