import AppKit
import SwiftUI
import AgenticToolkitCore
import AgenticToolkitCoreMacOS

/// The Work Groups window: a split-pane interface for managing window groups.
///
/// Layout:
/// ```
/// +--------------------+----------------------------------+
/// |                    |  Window Explorer (top-right)     |
/// |  Work Group List   |  (running apps + windows picker) |
/// |  (left sidebar)    |----------------------------------|
/// |                    |  Assigned Windows (bottom-right) |
/// |  [+ New Group]     |  (windows in selected group)     |
/// +--------------------+----------------------------------+
/// ```
public struct WorkGroupsView: View {
    @EnvironmentObject private var appState: SystemWindowContextsModel

    /// The currently selected work group in the sidebar.
    @State private var selectedGroupID: UUID?

    /// Window IDs checked in the explorer. Synced from the selected group.
    @State private var checkedWindowIDs: Set<UInt32> = []

    public init() {}

    public var body: some View {
        HSplitView {
            WorkGroupSidebarView(selectedGroupID: $selectedGroupID)
                .environmentObject(appState)
                .frame(minWidth: 180, idealWidth: 220, maxWidth: 300)

            VSplitView {
                WindowExplorerView(
                    selectedWindowIDs: $checkedWindowIDs,
                    activeGroupID: selectedGroupID
                )
                .frame(minHeight: 150)

                AssignedWindowsView(
                    groupID: selectedGroupID,
                    contexts: appState.contexts
                )
                .environmentObject(appState)
                .frame(minHeight: 120)
            }
        }
        .frame(minWidth: 600, idealWidth: 800, minHeight: 400, idealHeight: 600)
        .onChange(of: selectedGroupID) { _, _ in syncChecks() }
        .onChange(of: appState.contexts) { _, _ in syncChecks() }
        .onChange(of: checkedWindowIDs) { _, newSet in applyToggleChanges(newSet) }
    }

    /// Syncs checkedWindowIDs from the selected group's actual windows.
    private func syncChecks() {
        guard let id = selectedGroupID,
              let group = appState.contexts.first(where: { $0.id == id }) else {
            checkedWindowIDs = []
            return
        }
        checkedWindowIDs = Set(group.windowSnapshots.compactMap(\.windowID))
    }

    /// Diffs the toggle state against the group and applies add/remove.
    private func applyToggleChanges(_ newSet: Set<UInt32>) {
        guard let groupID = selectedGroupID,
              let group = appState.contexts.first(where: { $0.id == groupID }) else {
            return
        }
        let currentSet = Set(group.windowSnapshots.compactMap(\.windowID))
        let added = newSet.subtracting(currentSet)
        let removed = currentSet.subtracting(newSet)

        if !added.isEmpty {
            appState.addWindows(windowIDs: Array(added), to: groupID)
        }
        for wid in removed {
            appState.removeWindow(windowID: wid)
        }
    }
}

// MARK: - Sidebar

/// Left sidebar listing work groups with create, select, rename, and delete.
struct WorkGroupSidebarView: View {
    @EnvironmentObject private var appState: SystemWindowContextsModel
    @Binding var selectedGroupID: UUID?

    @State private var isCreating = false
    @State private var newName = ""
    @State private var editingID: UUID?
    @State private var editingName = ""
    @State private var groupToDelete: UUID?

    var body: some View {
        VStack(spacing: 0) {
            header
            Divider()
            groupList
            Divider()
            footer
        }
        .alert("Delete Work Group?", isPresented: showingDeleteAlert) {
            Button("Cancel", role: .cancel) { groupToDelete = nil }
            Button("Delete", role: .destructive) {
                if let id = groupToDelete {
                    appState.deleteContext(id: id)
                    if selectedGroupID == id { selectedGroupID = nil }
                    groupToDelete = nil
                }
            }
        } message: {
            if let id = groupToDelete,
               let group = appState.contexts.first(where: { $0.id == id }) {
                Text("Delete \"\(group.name)\"? Its windows will be unassigned.")
            } else {
                Text("Delete this work group?")
            }
        }
    }

    private var showingDeleteAlert: Binding<Bool> {
        Binding(
            get: { groupToDelete != nil },
            set: { if !$0 { groupToDelete = nil } }
        )
    }

    private var header: some View {
        HStack {
            Text("Work Groups")
                .font(.headline)
            Spacer()
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
    }

    private var groupList: some View {
        List(selection: $selectedGroupID) {
            ForEach(appState.contexts) { context in
                groupRow(context)
                    .tag(context.id)
            }

            if isCreating {
                newGroupRow
            }
        }
        .listStyle(.sidebar)
    }

    private func groupRow(_ context: SystemWindowContext) -> some View {
        let isEditing = editingID == context.id
        let isActive = context.id == appState.activeContextID

        return HStack(spacing: 8) {
            Circle()
                .fill(Color(hex: context.color) ?? .blue)
                .frame(width: 10, height: 10)

            if isEditing {
                TextField("Name", text: $editingName)
                    .textFieldStyle(.plain)
                    .onSubmit { commitRename(context.id) }
                    .onExitCommand { editingID = nil }
            } else {
                Text(context.name)
                    .fontWeight(isActive ? .semibold : .regular)
                    .lineLimit(1)
            }

            Spacer()

            if context.windowSnapshots.count > 0 {
                Text("\(context.liveWindowCount)/\(context.windowSnapshots.count)")
                    .font(.system(size: 10))
                    .foregroundStyle(.tertiary)
                    .monospacedDigit()
            }
        }
        .contentShape(Rectangle())
        .contextMenu {
            Button("Rename") {
                editingID = context.id
                editingName = context.name
            }
            Divider()
            Button("Delete", role: .destructive) {
                groupToDelete = context.id
            }
        }
    }

    private var newGroupRow: some View {
        HStack(spacing: 8) {
            Circle()
                .fill(Color.blue)
                .frame(width: 10, height: 10)

            TextField("Group name", text: $newName)
                .textFieldStyle(.plain)
                .onSubmit { commitCreate() }
                .onExitCommand { cancelCreate() }
        }
    }

    private var footer: some View {
        HStack {
            Button {
                isCreating = true
                newName = ""
            } label: {
                Image(systemName: "plus")
            }
            .buttonStyle(.borderless)
            .disabled(isCreating)

            Spacer()
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
    }

    private func commitCreate() {
        let name = newName.trimmingCharacters(in: .whitespaces)
        guard !name.isEmpty else { cancelCreate(); return }

        if let newID = appState.createContextReturningID(name: name) {
            selectedGroupID = newID
        }
        isCreating = false
        newName = ""
    }

    private func cancelCreate() {
        isCreating = false
        newName = ""
    }

    private func commitRename(_ id: UUID) {
        let trimmed = editingName.trimmingCharacters(in: .whitespaces)
        if !trimmed.isEmpty {
            appState.renameContext(id: id, to: trimmed)
        }
        editingID = nil
    }
}

// MARK: - Assigned Windows

/// Bottom-right pane showing windows assigned to the selected work group.
struct AssignedWindowsView: View {
    @EnvironmentObject private var appState: SystemWindowContextsModel
    let groupID: UUID?
    let contexts: [SystemWindowContext]

    private var selectedGroup: SystemWindowContext? {
        guard let id = groupID else { return nil }
        return contexts.first(where: { $0.id == id })
    }

    var body: some View {
        VStack(spacing: 0) {
            assignedHeader
            Divider()

            if let group = selectedGroup {
                if group.windowSnapshots.isEmpty {
                    emptyAssigned
                } else {
                    assignedList(group)
                }
            } else {
                noGroupSelected
            }
        }
    }

    private var assignedHeader: some View {
        HStack {
            Image(systemName: "macwindow.on.rectangle")
                .font(.title3)
                .foregroundStyle(.secondary)
            if let group = selectedGroup {
                Text("\(group.name) Windows")
                    .font(.headline)
            } else {
                Text("Assigned Windows")
                    .font(.headline)
            }
            Spacer()
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
    }

    private var noGroupSelected: some View {
        VStack(spacing: 8) {
            Spacer()
            Image(systemName: "sidebar.left")
                .font(.system(size: 28))
                .foregroundStyle(.tertiary)
            Text("Select a work group")
                .foregroundStyle(.secondary)
            Spacer()
        }
        .frame(maxWidth: .infinity)
    }

    private var emptyAssigned: some View {
        VStack(spacing: 8) {
            Spacer()
            Image(systemName: "rectangle.dashed")
                .font(.system(size: 28))
                .foregroundStyle(.tertiary)
            Text("No windows assigned")
                .foregroundStyle(.secondary)
            Text("Select windows above and click Add.")
                .font(.system(size: 11))
                .foregroundStyle(.tertiary)
            Spacer()
        }
        .frame(maxWidth: .infinity)
    }

    private func assignedList(_ group: SystemWindowContext) -> some View {
        let grouped = Dictionary(grouping: group.windowSnapshots, by: \.app)
        let sorted = grouped.sorted { $0.key.localizedCaseInsensitiveCompare($1.key) == .orderedAscending }

        return List {
            ForEach(sorted, id: \.key) { app, snapshots in
                Section(app) {
                    ForEach(snapshots) { snapshot in
                        assignedWindowRow(snapshot, groupID: group.id)
                    }
                }
            }
        }
        .listStyle(.inset(alternatesRowBackgrounds: true))
    }

    private func assignedWindowRow(_ snapshot: SystemWindowSnapshot, groupID: UUID) -> some View {
        HStack(spacing: 8) {
            VStack(alignment: .leading, spacing: 0) {
                Text(snapshot.title.isEmpty ? "(untitled)" : snapshot.title)
                    .font(.callout)
                    .lineLimit(1)
                    .truncationMode(.middle)
                    .foregroundStyle(snapshot.isLive ? .primary : .secondary)

                HStack(spacing: 4) {
                    Text("\(Int(snapshot.savedFrame.width))x\(Int(snapshot.savedFrame.height))")
                        .font(.caption2.monospaced())
                        .foregroundStyle(.tertiary)

                    if !snapshot.isLive {
                        Text("dormant")
                            .font(.caption2.bold())
                            .foregroundStyle(.orange)
                            .padding(.horizontal, 4)
                            .background(Color.orange.opacity(0.12), in: Capsule())
                    }
                }
            }

            Spacer()

            Button {
                if snapshot.isLive, let wid = snapshot.windowID {
                    appState.removeWindow(windowID: wid)
                } else {
                    appState.removeSnapshot(id: snapshot.id, from: groupID)
                }
            } label: {
                Image(systemName: "minus.circle.fill")
                    .foregroundStyle(.red)
            }
            .buttonStyle(.borderless)
            .help("Remove from group")
        }
        .opacity(snapshot.isLive ? 1.0 : 0.7)
    }
}
