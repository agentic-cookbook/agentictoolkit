import SwiftUI
import AgenticToolkitCore
import AgenticToolkitCoreMacOS

/// Discovery window that shows all running windows grouped by app,
/// lets you create a new context and batch-add windows to it.
///
/// Composes WindowExplorerView with a bottom action bar for adding
/// selected windows to new or existing contexts.
public struct DiscoveryView: View {
    @EnvironmentObject private var appState: SystemWindowContextsModel

    /// Set of selected window IDs for batch-adding.
    @State private var selectedWindowIDs: Set<UInt32> = []

    /// Whether the new-context inline form is showing.
    @State private var isCreatingContext = false

    /// Name for a new context.
    @State private var newContextName = ""

    /// Color for a new context.
    @State private var newContextColor = Color.blue

    public init() {}

    public var body: some View {
        VStack(spacing: 0) {
            WindowExplorerView(
                selectedWindowIDs: $selectedWindowIDs,
                refreshNotification: .discoveryPanelShown
            )
            Divider()
            bottomBar
        }
        .frame(minWidth: 500, idealWidth: 560, minHeight: 400, idealHeight: 550)
    }

    // MARK: - Bottom Bar

    private var bottomBar: some View {
        VStack(spacing: 10) {
            if isCreatingContext {
                newContextForm
            }

            HStack(spacing: 12) {
                Text("\(selectedWindowIDs.count) selected")
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
                    .frame(width: 80, alignment: .leading)

                Spacer()

                if !isCreatingContext {
                    Button("New \(appState.contextNoun) + Add") {
                        isCreatingContext = true
                    }
                    .disabled(selectedWindowIDs.isEmpty)
                }

                Menu {
                    ForEach(appState.contexts) { ctx in
                        Button {
                            addSelectedWindows(to: ctx.id)
                        } label: {
                            Label(ctx.name, systemImage: "circle.fill")
                        }
                    }
                } label: {
                    Text("Add to \(appState.contextNoun)")
                }
                .disabled(selectedWindowIDs.isEmpty || appState.contexts.isEmpty)
                .menuStyle(.borderlessButton)
                .fixedSize()
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
    }

    private var newContextForm: some View {
        HStack(spacing: 8) {
            ColorPicker("", selection: $newContextColor, supportsOpacity: false)
                .labelsHidden()
                .frame(width: 24)

            TextField("\(appState.contextNoun) name", text: $newContextName)
                .textFieldStyle(.roundedBorder)
                .onSubmit { commitNewContext() }

            Button("Create & Add") {
                commitNewContext()
            }
            .disabled(newContextName.trimmingCharacters(in: .whitespaces).isEmpty)
            .keyboardShortcut(.defaultAction)

            Button("Cancel") {
                isCreatingContext = false
                newContextName = ""
            }
        }
    }

    // MARK: - Actions

    private func addSelectedWindows(to contextID: UUID) {
        let ids = Array(selectedWindowIDs)
        appState.addWindows(windowIDs: ids, to: contextID)
        selectedWindowIDs.removeAll()
    }

    private func commitNewContext() {
        let name = newContextName.trimmingCharacters(in: .whitespaces)
        guard !name.isEmpty else { return }

        let hex = newContextColor.toHexString()
        if let newID = appState.createContextReturningID(name: name, color: hex) {
            addSelectedWindows(to: newID)
        }

        isCreatingContext = false
        newContextName = ""
        newContextColor = .blue
    }
}
