import SwiftUI
import CodeEditLanguages

// MARK: - Custom File Type Mapping Model

/// A user-defined mapping from a file extension to a language name and icon.
///
/// Custom mappings take precedence over the built-in CodeEditLanguages
/// detection, allowing users to override or extend file type associations.
public struct CustomFileTypeMapping: Codable, Identifiable, Equatable, Sendable {
    public var id: String { fileExtension }

    /// The file extension without the leading dot (e.g., "tsx", "conf").
    public let fileExtension: String

    /// The display name for this language (e.g., "TypeScript React").
    public var languageName: String

    /// The SF Symbol name for the file icon (e.g., "doc.text", "swift").
    public var iconName: String

    public init(fileExtension: String, languageName: String, iconName: String) {
        self.fileExtension = fileExtension
        self.languageName = languageName
        self.iconName = iconName
    }
}

// MARK: - Custom Mappings Store

/// Manages persistence and lookup for user-defined file type mappings.
///
/// Mappings are stored as JSON in UserDefaults and consulted before
/// the built-in `CodeEditLanguages` detection. A cached lookup dictionary
/// avoids repeated JSON decoding on every file icon resolution.
///
/// The UserDefaults key is configurable via `activeDefaultsKey`. Host
/// applications should set this once at startup (typically from their
/// `FileTreeConfig.customMappingsDefaultsKey`) before any UI consults the
/// mappings. Reading call sites that don't carry a `FileTreeConfig`
/// (e.g., `FileTreeNode.fileIconName`) rely on this static.
public enum CustomFileTypeMappings {

    /// The UserDefaults key used by `load` / `save` / `mapping(for:)`.
    /// Host apps override this at startup from their `FileTreeConfig`.
    nonisolated(unsafe) public static var activeDefaultsKey: String = FileTreeConfig.default.customMappingsDefaultsKey

    /// Cached lookup dictionary keyed by lowercased extension.
    /// Invalidated when `save` is called.
    nonisolated(unsafe) private static var cache: [String: CustomFileTypeMapping]?

    /// Loads custom mappings from UserDefaults.
    public static func load() -> [CustomFileTypeMapping] {
        guard let data = UserDefaults.standard.data(forKey: activeDefaultsKey) else {
            return []
        }
        return (try? JSONDecoder().decode([CustomFileTypeMapping].self, from: data)) ?? []
    }

    /// Saves custom mappings to UserDefaults and invalidates the lookup cache.
    public static func save(_ mappings: [CustomFileTypeMapping]) {
        guard let data = try? JSONEncoder().encode(mappings) else { return }
        UserDefaults.standard.set(data, forKey: activeDefaultsKey)
        cache = nil
    }

    /// Returns the custom mapping for a file extension, if one exists.
    ///
    /// Uses a cached dictionary for fast lookups during file tree rendering,
    /// avoiding repeated JSON decoding from UserDefaults.
    public static func mapping(for fileExtension: String) -> CustomFileTypeMapping? {
        if cache == nil {
            let mappings = load()
            cache = Dictionary(uniqueKeysWithValues: mappings.map { ($0.fileExtension.lowercased(), $0) })
        }
        return cache?[fileExtension.lowercased()]
    }
}

// MARK: - Built-in File Type Entry

/// A read-only display entry for a built-in language from CodeEditLanguages.
private struct BuiltInFileType: Identifiable {
    public let id: String
    public let fileExtension: String
    public let languageName: String
    public let iconName: String

    /// Derives built-in entries from CodeEditLanguages definitions.
    public static func allBuiltIn() -> [BuiltInFileType] {
        var entries: [BuiltInFileType] = []
        for lang in CodeLanguage.allLanguages {
            for ext in lang.extensions.sorted() {
                // Skip empty extensions and internal languages
                guard !ext.isEmpty else { continue }
                entries.append(BuiltInFileType(
                    id: "builtin-\(ext)",
                    fileExtension: ext,
                    languageName: lang.tsName.capitalized,
                    iconName: iconForExtension(ext)
                ))
            }
        }
        return entries.sorted { $0.fileExtension.localizedCaseInsensitiveCompare($1.fileExtension) == .orderedAscending }
    }

    /// Maps a file extension to an SF Symbol icon, matching the logic in FileTreeNode.
    private static func iconForExtension(_ ext: String) -> String {
        switch ext.lowercased() {
        case "swift":
            return "swift"
        case "json":
            return "curlybraces"
        case "md", "markdown", "mkd", "mkdn", "mdwn", "mdown":
            return "doc.richtext"
        case "txt", "text":
            return "doc.text"
        case "plist":
            return "list.bullet.rectangle"
        case "xcodeproj", "xcworkspace":
            return "hammer.fill"
        case "entitlements":
            return "lock.shield"
        case "png", "jpg", "jpeg", "gif", "svg", "ico":
            return "photo"
        case "yaml", "yml", "toml":
            return "gearshape.2"
        case "sh", "zsh", "bash":
            return "terminal"
        case "py":
            return "chevron.left.forwardslash.chevron.right"
        case "js", "ts", "cjs", "mjs", "cts", "mts":
            return "chevron.left.forwardslash.chevron.right"
        case "css", "html", "htm", "shtml":
            return "globe"
        case "gitignore":
            return "eye.slash"
        default:
            return "doc"
        }
    }
}

// MARK: - File Types Settings View

/// Settings tab for viewing built-in file type associations and adding custom ones.
///
/// Shows a table of all recognized file extensions with their language name
/// and icon. Users can add custom mappings that override the built-in detection.
public struct FileTypesSettingsView: View {

    // MARK: - State

    @State private var customMappings: [CustomFileTypeMapping] = CustomFileTypeMappings.load()
    @State private var builtInTypes: [BuiltInFileType] = BuiltInFileType.allBuiltIn()
    @State private var showingAddSheet = false
    @State private var searchText = ""

    public init() {}

    // MARK: - Body

    public var body: some View {
        VStack(spacing: 0) {
            // Toolbar
            HStack {
                TextField("Search file types...", text: $searchText)
                    .textFieldStyle(.roundedBorder)
                    .frame(maxWidth: 200)

                Spacer()

                Button {
                    showingAddSheet = true
                } label: {
                    Label("Add Custom Type", systemImage: "plus")
                }
            }
            .padding(.horizontal)
            .padding(.vertical, 8)

            Divider()

            // Table
            List {
                if !filteredCustomMappings.isEmpty {
                    Section("Custom Mappings") {
                        ForEach(filteredCustomMappings) { mapping in
                            FileTypeRow(
                                fileExtension: mapping.fileExtension,
                                languageName: mapping.languageName,
                                iconName: mapping.iconName,
                                isCustom: true
                            )
                            .contextMenu {
                                Button("Delete", role: .destructive) {
                                    removeCustomMapping(mapping)
                                }
                            }
                        }
                    }
                }

                Section("Built-in Types (\(filteredBuiltInTypes.count))") {
                    ForEach(filteredBuiltInTypes) { entry in
                        FileTypeRow(
                            fileExtension: entry.fileExtension,
                            languageName: entry.languageName,
                            iconName: entry.iconName,
                            isCustom: false
                        )
                    }
                }
            }
            .listStyle(.inset(alternatesRowBackgrounds: true))
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .sheet(isPresented: $showingAddSheet) {
            AddCustomFileTypeSheet(
                existingExtensions: Set(customMappings.map { $0.fileExtension.lowercased() }),
                onSave: { mapping in
                    addCustomMapping(mapping)
                }
            )
        }
    }

    // MARK: - Filtered Data

    private var filteredCustomMappings: [CustomFileTypeMapping] {
        if searchText.isEmpty { return customMappings }
        let query = searchText.lowercased()
        return customMappings.filter {
            $0.fileExtension.lowercased().contains(query)
            || $0.languageName.lowercased().contains(query)
        }
    }

    private var filteredBuiltInTypes: [BuiltInFileType] {
        if searchText.isEmpty { return builtInTypes }
        let query = searchText.lowercased()
        return builtInTypes.filter {
            $0.fileExtension.lowercased().contains(query)
            || $0.languageName.lowercased().contains(query)
        }
    }

    // MARK: - Actions

    private func addCustomMapping(_ mapping: CustomFileTypeMapping) {
        customMappings.append(mapping)
        customMappings.sort { $0.fileExtension.localizedCaseInsensitiveCompare($1.fileExtension) == .orderedAscending }
        CustomFileTypeMappings.save(customMappings)
    }

    private func removeCustomMapping(_ mapping: CustomFileTypeMapping) {
        customMappings.removeAll { $0.fileExtension == mapping.fileExtension }
        CustomFileTypeMappings.save(customMappings)
    }
}

// MARK: - File Type Row

/// A single row displaying a file type's extension, language name, and icon.
private struct FileTypeRow: View {
    public let fileExtension: String
    public let languageName: String
    public let iconName: String
    public let isCustom: Bool

    public var body: some View {
        HStack(spacing: 12) {
            Image(systemName: iconName)
                .frame(width: 20)
                .foregroundStyle(isCustom ? .blue : .secondary)

            Text(".\(fileExtension)")
                .font(.system(.body, design: .monospaced))
                .frame(width: 100, alignment: .leading)

            Text(languageName)
                .foregroundStyle(.secondary)

            Spacer()

            if isCustom {
                Text("Custom")
                    .font(.caption)
                    .foregroundStyle(.blue)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Color.blue.opacity(0.1))
                    .clipShape(RoundedRectangle(cornerRadius: 4))
            }
        }
        .padding(.vertical, 2)
    }
}

// MARK: - Add Custom File Type Sheet

/// Sheet for adding a new custom file type mapping.
private struct AddCustomFileTypeSheet: View {
    public let existingExtensions: Set<String>
    public let onSave: (CustomFileTypeMapping) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var fileExtension = ""
    @State private var languageName = ""
    @State private var selectedIcon = "doc"

    /// Common SF Symbol icon choices for file types.
    private let iconChoices: [(name: String, symbol: String)] = [
        ("Document", "doc"),
        ("Text Document", "doc.text"),
        ("Rich Text", "doc.richtext"),
        ("Code", "chevron.left.forwardslash.chevron.right"),
        ("Terminal", "terminal"),
        ("Globe", "globe"),
        ("Curly Braces", "curlybraces"),
        ("Gear", "gearshape.2"),
        ("Photo", "photo"),
        ("Hammer", "hammer.fill"),
        ("Lock", "lock.shield"),
        ("Eye Slash", "eye.slash"),
        ("Circle", "circle.fill")
    ]

    private var isValid: Bool {
        let ext = fileExtension.trimmingCharacters(in: .whitespaces).lowercased()
        return !ext.isEmpty
            && !languageName.trimmingCharacters(in: .whitespaces).isEmpty
            && !existingExtensions.contains(ext)
    }

    private var extensionConflict: Bool {
        let ext = fileExtension.trimmingCharacters(in: .whitespaces).lowercased()
        return !ext.isEmpty && existingExtensions.contains(ext)
    }

    public var body: some View {
        VStack(spacing: 0) {
            Text("Add Custom File Type")
                .font(.headline)
                .padding(.top, 16)
                .padding(.bottom, 12)

            Form {
                Section {
                    TextField("Extension (without dot)", text: $fileExtension)
                        .textFieldStyle(.roundedBorder)

                    if extensionConflict {
                        Text("A custom mapping for this extension already exists.")
                            .font(.caption)
                            .foregroundStyle(.red)
                    }
                }

                Section {
                    TextField("Language Name", text: $languageName)
                        .textFieldStyle(.roundedBorder)
                }

                Section("Icon") {
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 44))], spacing: 8) {
                        ForEach(iconChoices, id: \.symbol) { choice in
                            Button {
                                selectedIcon = choice.symbol
                            } label: {
                                Image(systemName: choice.symbol)
                                    .font(.title3)
                                    .frame(width: 36, height: 36)
                                    .background(
                                        selectedIcon == choice.symbol
                                            ? Color.accentColor.opacity(0.2)
                                            : Color.clear
                                    )
                                    .clipShape(RoundedRectangle(cornerRadius: 6))
                            }
                            .buttonStyle(.plain)
                            .help(choice.name)
                        }
                    }
                }
            }
            .formStyle(.grouped)

            Divider()

            HStack {
                Button("Cancel") {
                    dismiss()
                }
                .keyboardShortcut(.cancelAction)

                Spacer()

                Button("Add") {
                    let mapping = CustomFileTypeMapping(
                        fileExtension: fileExtension
                            .trimmingCharacters(in: .whitespaces)
                            .lowercased()
                            .replacingOccurrences(of: ".", with: ""),
                        languageName: languageName.trimmingCharacters(in: .whitespaces),
                        iconName: selectedIcon
                    )
                    onSave(mapping)
                    dismiss()
                }
                .keyboardShortcut(.defaultAction)
                .disabled(!isValid)
            }
            .padding()
        }
        .frame(width: 400, height: 420)
    }
}
