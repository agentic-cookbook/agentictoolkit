import SwiftUI
import AgenticToolkitCore
import AgenticToolkitCoreMacOS

/// The contexts tab within Settings, showing a list of contexts with
/// inline rename, color picker, delete, and window count.
public struct ContextsSettingsTab: View {
    @EnvironmentObject private var appState: SystemWindowContextsModel

    /// Tracks which context ID is being edited for rename.
    @State private var editingContextID: UUID?

    /// The text currently being typed in a rename field.
    @State private var editingName: String = ""

    /// Whether the delete confirmation alert is showing.
    @State private var contextToDelete: UUID?

    public init() {}

    public var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if appState.contexts.isEmpty {
                emptyState
            } else {
                contextList
            }
        }
        .padding()
        .alert("Delete \(appState.contextNoun)?", isPresented: showingDeleteAlert) {
            Button("Cancel", role: .cancel) {
                contextToDelete = nil
            }
            Button("Delete", role: .destructive) {
                if let id = contextToDelete {
                    appState.deleteContext(id: id)
                    contextToDelete = nil
                }
            }
        } message: {
            if let id = contextToDelete,
               let context = appState.contexts.first(where: { $0.id == id }) {
                Text("Are you sure you want to delete \"\(context.name)\"? This will unassign all its windows.")
            } else {
                Text("Are you sure you want to delete this \(appState.contextNoun)?")
            }
        }
    }

    private var showingDeleteAlert: Binding<Bool> {
        Binding(
            get: { contextToDelete != nil },
            set: { if !$0 { contextToDelete = nil } }
        )
    }

    private var emptyState: some View {
        VStack(spacing: 12) {
            Spacer()
            Image(systemName: "square.stack.3d.up.slash")
                .font(.system(size: 36))
                .foregroundStyle(.secondary)
            Text("No \(appState.contextNounPlural) yet")
                .font(.headline)
                .foregroundStyle(.secondary)
            Text("Create a \(appState.contextNoun) from the menu bar to get started.")
                .font(.callout)
                .foregroundStyle(.tertiary)
            Spacer()
        }
        .frame(maxWidth: .infinity)
    }

    private var contextList: some View {
        List {
            ForEach(appState.contexts) { context in
                contextRow(for: context)
            }
        }
        .listStyle(.inset(alternatesRowBackgrounds: true))
    }

    private func contextRow(for context: SystemWindowContext) -> some View {
        let isActive = context.id == appState.activeContextID
        let isEditing = editingContextID == context.id

        return HStack(spacing: 10) {
            // Color picker
            ColorPicker(
                "",
                selection: colorBinding(for: context),
                supportsOpacity: false
            )
            .labelsHidden()
            .frame(width: 24)

            // Name (editable or display)
            if isEditing {
                TextField("\(appState.contextNoun) name", text: $editingName)
                    .textFieldStyle(.roundedBorder)
                    .onSubmit {
                        commitRename(for: context.id)
                    }
                    .onExitCommand {
                        editingContextID = nil
                    }

                Button("Done") {
                    commitRename(for: context.id)
                }
                .buttonStyle(.bordered)
                .controlSize(.small)
            } else {
                Text(context.name)
                    .fontWeight(isActive ? .semibold : .regular)
                    .onTapGesture(count: 2) {
                        startRename(for: context)
                    }

                if isActive {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(.green)
                        .font(.caption)
                }
            }

            Spacer()

            // Window count
            let liveCount = context.liveWindowCount
            let totalCount = context.windowSnapshots.count
            if totalCount > 0 {
                Text("\(liveCount)/\(totalCount) windows")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .monospacedDigit()
            }

            // Edit (rename) button
            if !isEditing {
                Button {
                    startRename(for: context)
                } label: {
                    Image(systemName: "pencil")
                }
                .buttonStyle(.borderless)
                .help("Rename \(appState.contextNoun)")
            }

            // Delete button
            Button {
                contextToDelete = context.id
            } label: {
                Image(systemName: "trash")
                    .foregroundStyle(.red)
            }
            .buttonStyle(.borderless)
            .help("Delete \(appState.contextNoun)")
        }
        .padding(.vertical, 2)
    }

    /// Creates a binding that bridges the Color picker to the context's hex color.
    private func colorBinding(for context: SystemWindowContext) -> Binding<Color> {
        Binding(
            get: {
                Color(hex: context.color) ?? .blue
            },
            set: { newColor in
                let hexString = newColor.toHexString()
                appState.updateContextColor(id: context.id, to: hexString)
            }
        )
    }

    private func startRename(for context: SystemWindowContext) {
        editingContextID = context.id
        editingName = context.name
    }

    private func commitRename(for contextID: UUID) {
        let trimmed = editingName.trimmingCharacters(in: .whitespaces)
        if !trimmed.isEmpty {
            appState.renameContext(id: contextID, to: trimmed)
        }
        editingContextID = nil
    }
}
