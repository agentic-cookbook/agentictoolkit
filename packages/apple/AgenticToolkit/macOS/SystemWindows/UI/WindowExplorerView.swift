import AppKit
import SwiftUI
import AgenticToolkitCore
import AgenticToolkitCoreMacOS

/// A group of windows for a single app.
struct AppWindowGroup: Identifiable {
    let app: String
    let windows: [SystemWindowInfo]
    var id: String { app }
}

/// Reusable window explorer that shows all running windows grouped by app
/// with selection checkboxes. Used by both DiscoveryView and WorkGroupsView.
struct WindowExplorerView: View {
    @EnvironmentObject private var appState: SystemWindowContextsModel

    /// Set of selected window IDs, managed by the parent.
    @Binding var selectedWindowIDs: Set<UInt32>

    /// Optional set of window IDs to exclude from display.
    var excludeWindowIDs: Set<UInt32> = []

    /// When set, windows belonging to this group are togglable (checked/unchecked)
    /// instead of disabled. Used by WorkGroupsView for direct assignment.
    var activeGroupID: UUID?

    /// Notification name that triggers a refresh when posted.
    var refreshNotification: Notification.Name?

    /// Grouped windows by app.
    @State private var appGroups: [AppWindowGroup] = []

    /// Whether we're loading the window list.
    @State private var isLoading = true

    /// Whether accessibility permission is missing.
    @State private var needsAccessibility = false

    var body: some View {
        VStack(spacing: 0) {
            headerBar
            Divider()
            windowList
        }
        .onAppear { refreshAsync() }
        .onReceive(NotificationCenter.default.publisher(for: NSApplication.didBecomeActiveNotification)) { _ in
            if needsAccessibility { refreshAsync() }
        }
        .modifier(OptionalNotificationModifier(name: refreshNotification) {
            refreshAsync()
        })
    }

    // MARK: - Header

    private var headerBar: some View {
        HStack {
            Image(systemName: "magnifyingglass.circle")
                .font(.title3)
                .foregroundStyle(.secondary)
            Text("Windows")
                .font(.headline)
            Spacer()
            Button {
                refreshAsync()
            } label: {
                Image(systemName: "arrow.clockwise")
            }
            .buttonStyle(.borderless)
            .help("Refresh window list")
            .disabled(isLoading)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
    }

    // MARK: - Window List

    private var windowList: some View {
        Group {
            if needsAccessibility {
                accessibilityBanner
            }

            if isLoading {
                VStack(spacing: 12) {
                    Spacer()
                    ProgressView()
                        .scaleEffect(0.8)
                    Text("Scanning windows...")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Spacer()
                }
                .frame(maxWidth: .infinity, minHeight: 200)
            } else if appGroups.isEmpty {
                VStack(spacing: 12) {
                    Spacer()
                    Image(systemName: "macwindow.on.rectangle")
                        .font(.system(size: 32))
                        .foregroundStyle(.tertiary)
                    Text("No windows found")
                        .foregroundStyle(.secondary)
                    Text("Make sure Accessibility permission is granted.")
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                    Spacer()
                }
                .frame(maxWidth: .infinity, minHeight: 200)
            } else {
                List {
                    ForEach(appGroups) { group in
                        Section {
                            ForEach(group.windows, id: \.id) { window in
                                windowRow(window)
                            }
                        } header: {
                            appSectionHeader(group.app, windows: group.windows)
                        }
                    }
                }
                .listStyle(.inset(alternatesRowBackgrounds: true))
            }
        }
    }

    private var accessibilityBanner: some View {
        HStack(spacing: 8) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(.orange)
            Text("Accessibility permission needed for window titles.")
                .font(.caption)
            Spacer()
            Button("Open Settings") {
                SystemAccessibilityPermission.request()
            }
            .font(.caption)
            .buttonStyle(.bordered)
            .controlSize(.small)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(Color.orange.opacity(0.1))
    }

    // MARK: - Rows

    /// Whether a window is selectable (can be toggled) in the explorer.
    private func isSelectable(_ window: SystemWindowInfo) -> Bool {
        let owner = appState.context(forWindowID: window.id)
        if owner == nil { return true }
        if let activeGroupID, owner?.id == activeGroupID { return true }
        return false
    }

    private func appSectionHeader(_ app: String, windows: [SystemWindowInfo]) -> some View {
        let selectableWindows = windows.filter { isSelectable($0) }
        let allSelected = !selectableWindows.isEmpty
            && selectableWindows.allSatisfy { selectedWindowIDs.contains($0.id) }

        return HStack(spacing: 8) {
            Toggle(isOn: Binding(
                get: { allSelected },
                set: { isOn in
                    if isOn {
                        for win in selectableWindows { selectedWindowIDs.insert(win.id) }
                    } else {
                        for win in selectableWindows { selectedWindowIDs.remove(win.id) }
                    }
                }
            )) {
                HStack(spacing: 8) {
                    let appIcon = NSRunningApplication
                        .runningApplications(withBundleIdentifier: bundleID(for: app))
                        .first?.icon
                    if let icon = appIcon {
                        Image(nsImage: icon)
                            .resizable()
                            .frame(width: 16, height: 16)
                    } else {
                        Image(systemName: "app.fill")
                            .frame(width: 16, height: 16)
                            .foregroundStyle(.secondary)
                    }

                    Text(app)
                        .font(.subheadline.bold())

                    Text("\(windows.count)")
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                        .padding(.horizontal, 4)
                        .background(Color.primary.opacity(0.06), in: Capsule())
                }
            }
            .toggleStyle(.checkbox)
            .disabled(selectableWindows.isEmpty)
        }
    }

    private func windowRow(_ window: SystemWindowInfo) -> some View {
        let selectable = isSelectable(window)
        let existingContext = appState.context(forWindowID: window.id)
        let showBadge = existingContext != nil
            && (activeGroupID == nil || existingContext?.id != activeGroupID)

        return Toggle(isOn: windowToggleBinding(window.id)) {
            HStack(spacing: 8) {
                VStack(alignment: .leading, spacing: 0) {
                    Text(window.title.isEmpty ? "(untitled)" : window.title)
                        .font(.callout)
                        .lineLimit(1)
                        .truncationMode(.middle)
                        .foregroundStyle(selectable ? .primary : .secondary)

                    HStack(spacing: 4) {
                        Text("\(Int(window.frame.width))x\(Int(window.frame.height))")
                            .font(.caption2.monospaced())
                            .foregroundStyle(.tertiary)

                        if showBadge, let ctx = existingContext {
                            Text(ctx.name)
                                .font(.caption2.bold())
                                .foregroundStyle(Color(hex: ctx.color) ?? .blue)
                                .padding(.horizontal, 4)
                                .background((Color(hex: ctx.color) ?? .blue).opacity(0.12), in: Capsule())
                        }
                    }
                }

                Spacer()
            }
        }
        .toggleStyle(.checkbox)
        .disabled(!selectable)
    }

    private func windowToggleBinding(_ windowID: UInt32) -> Binding<Bool> {
        Binding(
            get: { selectedWindowIDs.contains(windowID) },
            set: { isOn in
                if isOn {
                    selectedWindowIDs.insert(windowID)
                } else {
                    selectedWindowIDs.remove(windowID)
                }
            }
        )
    }

    // MARK: - Refresh

    private func refreshAsync() {
        isLoading = true

        let appState = self.appState
        let excludeIDs = self.excludeWindowIDs
        let isDirectAssignment = self.activeGroupID != nil

        Task.detached {
            let (allWindows, regularAppPIDs, hiddenApps) = await MainActor.run {
                let windows = appState.listAllWindows()
                let pids = Set(
                    NSWorkspace.shared.runningApplications
                        .filter { $0.activationPolicy == .regular }
                        .map { $0.processIdentifier }
                )
                let hidden = Set(appState.settings.hiddenApps)
                return (windows, pids, hidden)
            }

            let windows = allWindows.filter { window in
                regularAppPIDs.contains(window.pid)
                && window.frame.width > 50
                && window.frame.height > 50
                && window.isOnScreen
                && !hiddenApps.contains(window.app)
                && !excludeIDs.contains(window.id)
            }

            // AX enrichment
            var axTitlesByPID: [Int32: [(title: String, frame: CGRect)]] = [:]
            var axSucceeded = false
            for pid in Set(windows.map(\.pid)) {
                let appElement = AXUIElementCreateApplication(pid)
                var windowsRef: CFTypeRef?
                let result = AXUIElementCopyAttributeValue(appElement, kAXWindowsAttribute as CFString, &windowsRef)
                guard result == .success,
                      let axWindows = windowsRef as? [AXUIElement] else {
                    continue
                }
                axSucceeded = true
                var titles: [(title: String, frame: CGRect)] = []
                for axWin in axWindows {
                    let title = SystemWindowAXHelper.title(of: axWin) ?? ""
                    if let pos = SystemWindowAXHelper.position(of: axWin),
                       let size = SystemWindowAXHelper.size(of: axWin) {
                        titles.append((title: title, frame: CGRect(origin: pos, size: size)))
                    }
                }
                axTitlesByPID[pid] = titles
            }

            var enriched: [SystemWindowInfo] = []
            for var win in windows {
                if let axWindows = axTitlesByPID[win.pid],
                   let match = axWindows.first(where: {
                       abs($0.frame.origin.x - win.frame.origin.x) < 3
                       && abs($0.frame.origin.y - win.frame.origin.y) < 3
                       && abs($0.frame.width - win.frame.width) < 3
                       && abs($0.frame.height - win.frame.height) < 3
                   }), !match.title.isEmpty {
                    win = SystemWindowInfo(
                        id: win.id, app: win.app, pid: win.pid, title: match.title,
                        frame: win.frame, display: win.display,
                        isOnScreen: win.isOnScreen, layer: win.layer
                    )
                }
                enriched.append(win)
            }

            var groups: [String: [SystemWindowInfo]] = [:]
            for win in enriched {
                groups[win.app, default: []].append(win)
            }

            let sorted = groups.sorted { $0.key.localizedCaseInsensitiveCompare($1.key) == .orderedAscending }
                .map { AppWindowGroup(app: $0.key, windows: $0.value) }
            let currentIDs = Set(enriched.map(\.id))
            let showBanner = !axSucceeded && !windows.isEmpty

            await MainActor.run {
                appGroups = sorted
                // Only prune stale selections in discovery mode.
                // In work-group mode the binding represents persistent
                // group membership — don't remove assigned windows.
                if !isDirectAssignment {
                    selectedWindowIDs = selectedWindowIDs.intersection(currentIDs)
                }
                needsAccessibility = showBanner
                isLoading = false
            }
        }
    }

    // MARK: - Helpers

    private func bundleID(for appName: String) -> String {
        NSWorkspace.shared.runningApplications
            .first { $0.localizedName == appName }?
            .bundleIdentifier ?? ""
    }
}

// MARK: - Optional Notification Modifier

/// A view modifier that listens for an optional notification name.
/// If the name is nil, this is a no-op.
private struct OptionalNotificationModifier: ViewModifier {
    let name: Notification.Name?
    let action: () -> Void

    func body(content: Content) -> some View {
        if let name {
            content
                .onReceive(NotificationCenter.default.publisher(for: name)) { _ in
                    action()
                }
        } else {
            content
        }
    }
}
