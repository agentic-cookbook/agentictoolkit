import AppKit
import OSLog
import SwiftUI
import AgenticToolkitCore
import AgenticToolkitCoreMacOS

/// The General tab within Settings, showing launch-at-login toggle,
/// reconcile behavior picker, and filtered apps list.
public struct GeneralSettingsTab: View {
    @EnvironmentObject private var appState: SystemWindowContextsModel

    /// Whether the add-app menu is showing.
    @State private var showingAddApp = false

    public init() {}

    public var body: some View {
        Form {
            Section("Startup") {
                Toggle("Launch at login", isOn: launchAtLoginBinding)
                    .help("Automatically start this app when you log in to your Mac.")

                // Only menu-bar/accessory hosts manage their Dock visibility this
                // way; a regular app owns its own activation model, so hide the
                // toggle there rather than letting it hijack the host's policy.
                if appState.managesAppActivationPolicy {
                    Toggle("Show App in Dock", isOn: showAppInDockBinding)
                        .help("When enabled, the app appears in the Dock and Cmd-Tab switcher " +
                              "like a regular app. When disabled, it runs as a menu-bar-only accessory.")
                }
            }

            Section("Window Reconciliation") {
                Picker("When unmatched windows are detected:", selection: reconcileBehaviorBinding) {
                    Text("Prompt me to assign").tag(ReconcileBehavior.prompt)
                    Text("Auto-assign all matches").tag(ReconcileBehavior.auto)
                    Text("Ignore unmatched windows").tag(ReconcileBehavior.ignore)
                }
                .pickerStyle(.radioGroup)

                Text("Controls what happens on launch when previously tracked windows can't be automatically matched.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            filteredAppsSection

            Section("Data") {
                HStack {
                    Text("State directory:")
                        .foregroundStyle(.secondary)
                    Text((appState.stateDirectory.path as NSString).abbreviatingWithTildeInPath)
                        .font(.system(.body, design: .monospaced))
                    Spacer()
                    Button("Show in Finder") {
                        NSWorkspace.shared.selectFile(nil, inFileViewerRootedAtPath: appState.stateDirectory.path)
                    }
                    .controlSize(.small)
                }
            }
        }
        .formStyle(.grouped)
        .padding()
    }

    // MARK: - Filtered Apps

    private var filteredAppsSection: some View {
        Section("Filtered Apps") {
            let hiddenApps = appState.settings.hiddenApps

            if hiddenApps.isEmpty {
                Text("No apps are filtered. All apps appear in the Discover Windows list.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            } else {
                ForEach(hiddenApps, id: \.self) { app in
                    HStack {
                        Text(app)
                        Spacer()
                        Button {
                            appState.removeHiddenApp(app)
                        } label: {
                            Image(systemName: "minus.circle.fill")
                                .foregroundStyle(.red)
                        }
                        .buttonStyle(.borderless)
                        .help("Remove \(app) from filter")
                    }
                }
            }

            Menu {
                ForEach(availableAppsToFilter, id: \.self) { app in
                    Button(app) {
                        appState.addHiddenApp(app)
                    }
                }
                if availableAppsToFilter.isEmpty {
                    Text("No additional running apps to filter")
                }
            } label: {
                Label("Add App", systemImage: "plus.circle")
            }
            .menuStyle(.borderlessButton)
            .fixedSize()

            Text("Filtered apps are hidden from the Discover Windows list.")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }

    /// Running regular apps that are not already in the hidden list and not the host app itself.
    private var availableAppsToFilter: [String] {
        let hidden = Set(appState.settings.hiddenApps)
        return NSWorkspace.shared.runningApplications
            .filter { $0.activationPolicy == .regular }
            .compactMap { $0.localizedName }
            .filter { $0 != appState.selfAppName && !hidden.contains($0) }
            .sorted()
    }

    private var launchAtLoginBinding: Binding<Bool> {
        Binding(
            get: { appState.settings.launchAtLogin },
            set: { newValue in
                appState.setLaunchAtLogin(newValue)
                updateLoginItem(enabled: newValue)
            }
        )
    }

    private var reconcileBehaviorBinding: Binding<ReconcileBehavior> {
        Binding(
            get: { appState.settings.reconcileBehavior },
            set: { newValue in
                appState.setReconcileBehavior(newValue)
            }
        )
    }

    private var showAppInDockBinding: Binding<Bool> {
        Binding(
            get: { appState.settings.showAppInDock },
            set: { newValue in
                appState.setShowAppInDock(newValue)
                NSApp.setActivationPolicy(newValue ? .regular : .accessory)
            }
        )
    }

    /// Registers or unregisters the app as a login item via the toolkit's
    /// `LaunchAtLoginManager`, which wraps `SMAppService` with error handling and
    /// is unit-tested — rather than re-implementing the register/unregister dance
    /// inline. In SPM/debug builds this may fail, which is acceptable.
    private func updateLoginItem(enabled: Bool) {
        do {
            try LaunchAtLoginManager().setEnabled(enabled)
        } catch {
            logger.error(
                "Failed to \(enabled ? "register" : "unregister") login item: \(error.localizedDescription)"
            )
        }
    }
}

extension GeneralSettingsTab: Loggable {
    public static nonisolated let logger = makeLogger()
}
