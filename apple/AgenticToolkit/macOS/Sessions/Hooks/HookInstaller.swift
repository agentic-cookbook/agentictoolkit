import Foundation

/// Manages auto-installation of Claude Code hooks into `~/.claude/settings.json`.
/// Each hook writes a JSON event file to the session-events drop directory so that
/// Whippet can ingest and display session activity in real time.
///
/// The installer merges Whippet hooks with any existing user hooks (append, not overwrite)
/// and detects whether its hooks are already present to avoid duplicates.
public final class HookInstaller {

    // MARK: - Constants

    /// Marker embedded in every Whippet hook command so we can identify our hooks later.
    public static let whippetMarker = "# whippet-hook"

    /// The directory where hook event files are written.
    public static let defaultDropDirectory = "~/.claude/session-events"

    /// The event types that Whippet installs hooks for.
    public static let hookedEventTypes: [String] = [
        "SessionStart",
        "SessionEnd",
        "UserPromptSubmit",
        "PreToolUse",
        "PostToolUse",
        "Stop",
        "SubagentStart",
        "SubagentStop",
        "Notification",
    ]

    // MARK: - Properties

    /// Path to the Claude Code settings file.
    public let settingsURL: URL

    /// Path to the drop directory for event files.
    public let dropDirectory: String

    // MARK: - Initialization

    /// Creates a HookInstaller.
    /// - Parameters:
    ///   - settingsURL: The URL of the settings.json file. Defaults to `~/.claude/settings.json`.
    ///   - dropDirectory: The drop directory path used in hook commands. Defaults to `~/.claude/session-events`.
    public init(settingsURL: URL? = nil, dropDirectory: String? = nil) {
        if let url = settingsURL {
            self.settingsURL = url
        } else {
            self.settingsURL = FileManager.default.homeDirectoryForCurrentUser
                .appendingPathComponent(".claude")
                .appendingPathComponent("settings.json")
        }
        self.dropDirectory = dropDirectory ?? Self.defaultDropDirectory
    }

    // MARK: - Installation

    /// Result of an installation attempt.
    public enum InstallResult: Equatable {
        /// Hooks were freshly installed.
        case installed
        /// Hooks were already present; nothing was changed.
        case alreadyInstalled
        /// Installation failed with the given error description.
        case failed(String)
    }

    /// Installs Whippet hooks into the Claude Code settings file.
    /// - Returns: The result of the installation attempt.
    public func installHooks() -> InstallResult {
        do {
            var settings = try loadSettings()

            // Check if Whippet hooks are already installed
            if hooksAlreadyInstalled(in: settings) {
                Log.hooks.info("Hooks already installed in \(self.settingsURL.path, privacy: .public)")
                return .alreadyInstalled
            }

            // Get or create the hooks dictionary
            var hooks = settings["hooks"] as? [String: Any] ?? [:]

            // Install a hook for each event type
            for eventType in Self.hookedEventTypes {
                hooks = appendWhippetHook(eventType: eventType, to: hooks)
            }

            settings["hooks"] = hooks

            // Write the updated settings back
            try saveSettings(settings)

            Log.hooks.info("Hooks installed for \(Self.hookedEventTypes.count) event types in \(self.settingsURL.path, privacy: .public)")
            return .installed
        } catch {
            Log.hooks.error("Failed to install hooks: \(error.localizedDescription, privacy: .public)")
            return .failed(error.localizedDescription)
        }
    }

    /// Uninstalls all Whippet hooks from the Claude Code settings file.
    /// - Returns: `true` if hooks were removed, `false` if none were found or an error occurred.
    public func uninstallHooks() -> Bool {
        do {
            var settings = try loadSettings()

            guard var hooks = settings["hooks"] as? [String: Any] else {
                return false
            }

            var removed = false

            for eventType in Self.hookedEventTypes {
                if var matcherGroups = hooks[eventType] as? [[String: Any]] {
                    let originalCount = matcherGroups.count
                    matcherGroups = matcherGroups.filter { group in
                        !isWhippetMatcherGroup(group)
                    }
                    if matcherGroups.count < originalCount {
                        removed = true
                    }
                    if matcherGroups.isEmpty {
                        hooks.removeValue(forKey: eventType)
                    } else {
                        hooks[eventType] = matcherGroups
                    }
                }
            }

            if removed {
                settings["hooks"] = hooks.isEmpty ? nil : hooks
                try saveSettings(settings)
                Log.hooks.info("Hooks uninstalled from \(self.settingsURL.path, privacy: .public)")
            }

            return removed
        } catch {
            Log.hooks.error("Failed to uninstall hooks: \(error.localizedDescription, privacy: .public)")
            return false
        }
    }

    // MARK: - Detection

    /// Checks whether Whippet hooks are already installed in the given settings dictionary.
    public func hooksAlreadyInstalled(in settings: [String: Any]) -> Bool {
        guard let hooks = settings["hooks"] as? [String: Any] else {
            return false
        }

        // Check if at least one event type has a Whippet hook
        for eventType in Self.hookedEventTypes {
            if let matcherGroups = hooks[eventType] as? [[String: Any]] {
                for group in matcherGroups {
                    if isWhippetMatcherGroup(group) {
                        return true
                    }
                }
            }
        }

        return false
    }

    /// Checks whether a matcher group contains a Whippet hook (identified by the marker comment).
    private func isWhippetMatcherGroup(_ group: [String: Any]) -> Bool {
        guard let hookList = group["hooks"] as? [[String: Any]] else {
            return false
        }
        return hookList.contains { hook in
            guard let command = hook["command"] as? String else { return false }
            return command.contains(Self.whippetMarker)
        }
    }

    // MARK: - Hook Command Generation

    /// Appends a Whippet hook for the given event type to the hooks dictionary.
    /// Preserves any existing matcher groups for the same event type.
    private func appendWhippetHook(eventType: String, to hooks: [String: Any]) -> [String: Any] {
        var result = hooks
        var matcherGroups = hooks[eventType] as? [[String: Any]] ?? []

        let whippetMatcherGroup = makeWhippetMatcherGroup(eventType: eventType)
        matcherGroups.append(whippetMatcherGroup)

        result[eventType] = matcherGroups
        return result
    }

    /// Creates a matcher group dictionary for a Whippet hook.
    private func makeWhippetMatcherGroup(eventType: String) -> [String: Any] {
        let command = makeHookCommand(eventType: eventType)
        let hookEntry: [String: Any] = [
            "type": "command",
            "command": command,
        ]

        // No matcher -- we want to capture all events of this type
        return [
            "hooks": [hookEntry],
        ]
    }

    /// Generates the shell command for a hook that writes a JSON event file to the drop directory.
    ///
    /// The command:
    /// 1. Reads the full JSON payload from stdin (provided by Claude Code)
    /// 2. Uses `jq` to extract relevant fields and construct a Whippet event JSON
    /// 3. Writes the result to a uniquely-named file in the drop directory
    ///
    /// The command uses portable POSIX shell syntax and `jq` for JSON processing.
    public func makeHookCommand(eventType: String) -> String {
        // Build a jq filter that constructs the Whippet event JSON from stdin.
        // The stdin payload varies by event type but always contains session_id and cwd.
        let jqFilter = makeJqFilter(eventType: eventType)

        // Capture TERM_PROGRAM for all events so resumed sessions get grouped correctly.
        // SessionStart additionally captures PPID for dead-session detection.
        let extraCaptures: String
        let jqArgs: String
        if eventType == "SessionStart" {
            extraCaptures = "HOOK_PPID=$PPID\nHOOK_TERM=${TERM_PROGRAM:-}"
            jqArgs = #" --arg ppid "$HOOK_PPID" --arg term "$HOOK_TERM""#
        } else {
            extraCaptures = "HOOK_TERM=${TERM_PROGRAM:-}"
            jqArgs = #" --arg term "$HOOK_TERM""#
        }

        // The command:
        // - Reads stdin into a variable
        // - Constructs a filename with timestamp and a random suffix
        // - Pipes the input through jq to build the event JSON
        // - Writes to the drop directory
        // - The marker comment is on the first line so we can detect Whippet hooks
        var command = """
        \(Self.whippetMarker)
        INPUT=$(cat)
        TIMESTAMP=$(date +%s%N 2>/dev/null || date +%s)
        RAND=$(head -c 8 /dev/urandom | od -An -tx1 | tr -d ' \\n' 2>/dev/null || echo $$)
        DIR=\(dropDirectory)
        mkdir -p "$DIR"
        """

        command += "\n\(extraCaptures)"

        command += """

        OUTPUT=$(echo "$INPUT" | jq -c\(jqArgs) '\(jqFilter)' 2>/dev/null)
        [ -n "$OUTPUT" ] && echo "$OUTPUT" > "$DIR/${TIMESTAMP}-${RAND}.json"
        exit 0
        """

        return command
    }

    /// Builds a jq filter expression that constructs a Whippet event JSON object
    /// from the Claude Code hook stdin payload.
    private func makeJqFilter(eventType: String) -> String {
        // Common fields: event type, session_id, timestamp, and a data object
        // with event-specific fields extracted from the stdin payload.
        switch eventType {
        case "SessionStart":
            return """
            {event: "\(eventType)", session_id: .session_id, timestamp: (now | todate), data: {cwd: .cwd, model: (.model // ""), source: (.source // ""), pid: ($ppid | tonumber), term_program: $term}}
            """

        case "SessionEnd":
            return """
            {event: "\(eventType)", session_id: .session_id, timestamp: (now | todate), data: {cwd: .cwd, reason: (.reason // ""), term_program: $term}}
            """

        case "UserPromptSubmit":
            return """
            {event: "\(eventType)", session_id: .session_id, timestamp: (now | todate), data: {cwd: .cwd, prompt: (.prompt // ""), term_program: $term}}
            """

        case "PreToolUse":
            return """
            {event: "\(eventType)", session_id: .session_id, timestamp: (now | todate), data: {cwd: .cwd, tool: (.tool_name // ""), tool_input: (.tool_input // {}), term_program: $term}}
            """

        case "PostToolUse":
            return """
            {event: "\(eventType)", session_id: .session_id, timestamp: (now | todate), data: {cwd: .cwd, tool: (.tool_name // ""), tool_input: (.tool_input // {}), tool_response: (.tool_response // {}), term_program: $term}}
            """

        case "Stop":
            return """
            {event: "\(eventType)", session_id: .session_id, timestamp: (now | todate), data: {cwd: .cwd, term_program: $term}}
            """

        case "SubagentStart":
            return """
            {event: "\(eventType)", session_id: .session_id, timestamp: (now | todate), data: {cwd: .cwd, agent_id: (.agent_id // ""), agent_type: (.agent_type // ""), term_program: $term}}
            """

        case "SubagentStop":
            return """
            {event: "\(eventType)", session_id: .session_id, timestamp: (now | todate), data: {cwd: .cwd, agent_id: (.agent_id // ""), agent_type: (.agent_type // ""), term_program: $term}}
            """

        case "Notification":
            return """
            {event: "\(eventType)", session_id: .session_id, timestamp: (now | todate), data: {cwd: .cwd, message: (.message // ""), title: (.title // ""), notification_type: (.notification_type // ""), term_program: $term}}
            """

        default:
            // Generic fallback: capture session_id and cwd
            return """
            {event: "\(eventType)", session_id: .session_id, timestamp: (now | todate), data: {cwd: .cwd, term_program: $term}}
            """
        }
    }

    // MARK: - Settings File I/O

    /// Loads and parses the Claude Code settings.json file.
    /// Returns an empty dictionary if the file doesn't exist.
    public func loadSettings() throws -> [String: Any] {
        let fm = FileManager.default

        // Ensure the .claude directory exists
        let claudeDir = settingsURL.deletingLastPathComponent()
        if !fm.fileExists(atPath: claudeDir.path) {
            try fm.createDirectory(at: claudeDir, withIntermediateDirectories: true)
        }

        guard fm.fileExists(atPath: settingsURL.path) else {
            return [:]
        }

        let data = try Data(contentsOf: settingsURL)

        // Handle empty files
        if data.isEmpty {
            return [:]
        }

        guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw HookInstallerError.invalidSettingsFormat
        }

        return json
    }

    /// Writes the settings dictionary back to the settings.json file.
    /// Uses pretty-printed JSON with sorted keys for readability.
    public func saveSettings(_ settings: [String: Any]) throws {
        let fm = FileManager.default

        // Ensure the directory exists
        let claudeDir = settingsURL.deletingLastPathComponent()
        if !fm.fileExists(atPath: claudeDir.path) {
            try fm.createDirectory(at: claudeDir, withIntermediateDirectories: true)
        }

        let data = try JSONSerialization.data(
            withJSONObject: settings,
            options: [.prettyPrinted, .sortedKeys, .fragmentsAllowed]
        )

        try data.write(to: settingsURL, options: .atomic)
    }
}

// MARK: - Errors

/// Errors that can occur during hook installation.
public enum HookInstallerError: Error, LocalizedError {
    case invalidSettingsFormat
    case writeFailed(String)

    public var errorDescription: String? {
        switch self {
        case .invalidSettingsFormat:
            return "settings.json is not a valid JSON object"
        case .writeFailed(let message):
            return "Failed to write settings.json: \(message)"
        }
    }
}
