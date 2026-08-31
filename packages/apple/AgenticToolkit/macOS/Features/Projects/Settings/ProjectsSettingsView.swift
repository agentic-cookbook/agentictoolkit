import SwiftUI
import AgenticToolkitCore

/// The Projects settings panel's content: how project windows behave, and the
/// list of home-directory folders the project scan skips.
///
/// Each skip row says which of the user's own folders the pattern currently
/// excludes, because a glob with nothing behind it looks identical to a glob
/// that is quietly hiding half their work (`explicit-over-implicit`).
///
/// The explanatory prose that used to lead this view lives in the panel's help
/// drawer instead — a settings panel is a place to change things, not to read.
public struct ProjectsSettingsView: View {

    @State private var patterns: [String] = UserSettings.projectScanSkipPatterns.currentValue
    @State private var newPattern = ""
    @State private var highlightActivePane: Bool = UserSettings.highlightActivePane.currentValue
    @State private var homeFolders: [String] = ProjectsSettingsView.homeFolderNames()

    public init() {}

    public var body: some View {
        VStack(spacing: 0) {
            header
            Divider()
            List {
                Section("Skipped Folders") {
                    ForEach(patterns, id: \.self) { pattern in
                        row(for: pattern)
                    }
                }
            }
            .listStyle(.inset(alternatesRowBackgrounds: true))
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Pieces

    private var header: some View {
        VStack(alignment: .leading, spacing: 10) {
            Toggle("Outline the active pane", isOn: $highlightActivePane)
                .onChange(of: highlightActivePane) { _, isOn in
                    UserSettings.highlightActivePane.value = isOn
                }

            HStack {
                TextField("Folder name or pattern", text: $newPattern)
                    .textFieldStyle(.roundedBorder)
                    .frame(maxWidth: 240)
                    .onSubmit { add() }

                Button {
                    add()
                } label: {
                    Label("Add", systemImage: "plus")
                }
                .disabled(trimmedNewPattern.isEmpty || patterns.contains(trimmedNewPattern))

                Spacer()

                Button("Restore Defaults") {
                    store(GitRepoScanner.defaultRootSkipPatterns)
                }
                .disabled(patterns == GitRepoScanner.defaultRootSkipPatterns)
            }
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
    }

    private func row(for pattern: String) -> some View {
        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: 2) {
                Text(pattern)
                Text(matchDescription(for: pattern))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            Button {
                store(patterns.filter { $0 != pattern })
            } label: {
                Image(systemName: "minus.circle")
            }
            .buttonStyle(.borderless)
            .help("Stop skipping folders matching \(pattern)")
        }
        .padding(.vertical, 2)
    }

    // MARK: - Editing

    private var trimmedNewPattern: String {
        newPattern.trimmingCharacters(in: .whitespaces)
    }

    private func add() {
        let pattern = trimmedNewPattern
        guard !pattern.isEmpty, !patterns.contains(pattern) else { return }
        store(patterns + [pattern])
        newPattern = ""
    }

    /// One write, to the one place this list lives. The `@State` copy is what
    /// the list renders; the setting is what the next scan reads.
    private func store(_ newPatterns: [String]) {
        patterns = newPatterns
        UserSettings.projectScanSkipPatterns.value = newPatterns
    }

    // MARK: - What a pattern actually excludes

    private func matchDescription(for pattern: String) -> String {
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

    /// The visible folders of the home directory — the only things a root-only
    /// pattern can ever match.
    private static func homeFolderNames() -> [String] {
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
