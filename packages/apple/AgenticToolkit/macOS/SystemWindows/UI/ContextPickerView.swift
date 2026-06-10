import SwiftUI
import AgenticToolkitCore
import AgenticToolkitCoreMacOS

/// A searchable context picker popup triggered by a global keyboard shortcut.
///
/// The picker shows a text field for filtering, a list of matching contexts,
/// and allows the user to select a context with Enter or arrow keys.
/// Pressing Escape or clicking outside dismisses the picker.
public struct ContextPickerView: View {
    @EnvironmentObject private var appState: SystemWindowContextsModel

    /// The current search/filter text.
    @State private var searchText = ""

    /// The index of the currently highlighted context in the filtered list.
    @State private var selectedIndex = 0

    public init() {}

    /// Contexts that match the current search text.
    private var filteredContexts: [SystemWindowContext] {
        if searchText.isEmpty {
            return appState.contexts
        }
        let query = searchText.lowercased()
        return appState.contexts.filter {
            $0.name.lowercased().contains(query)
        }
    }

    public var body: some View {
        VStack(spacing: 0) {
            // Search field
            searchField

            Divider()

            // Filtered context list
            if filteredContexts.isEmpty {
                emptyState
            } else {
                contextList
            }
        }
        .frame(width: 320, height: 340)
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .strokeBorder(Color(nsColor: .separatorColor), lineWidth: 0.5)
        )
        .shadow(color: .black.opacity(0.2), radius: 20, y: 10)
        .onChange(of: searchText) { _, _ in
            // Reset selection when search text changes
            selectedIndex = 0
        }
    }

    // MARK: - Search Field

    private var searchField: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(.secondary)
            TextField("Search \(appState.contextNounPlural)...", text: $searchText)
                .textFieldStyle(.plain)
                .font(.system(size: 16))
                .onSubmit {
                    confirmSelection()
                }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
    }

    // MARK: - Empty State

    private var emptyState: some View {
        VStack(spacing: 8) {
            Spacer()
            Text("No matching \(appState.contextNounPlural)")
                .font(.callout)
                .foregroundStyle(.secondary)
            Spacer()
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Context List

    private var contextList: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 2) {
                    ForEach(Array(filteredContexts.enumerated()), id: \.element.id) { index, context in
                        contextRow(for: context, index: index)
                            .id(context.id)
                    }
                }
                .padding(.vertical, 4)
                .padding(.horizontal, 6)
            }
            .onChange(of: selectedIndex) { _, newIndex in
                if newIndex < filteredContexts.count {
                    withAnimation(.easeInOut(duration: 0.1)) {
                        proxy.scrollTo(filteredContexts[newIndex].id, anchor: .center)
                    }
                }
            }
        }
    }

    /// A single row in the context picker list.
    private func contextRow(for context: SystemWindowContext, index: Int) -> some View {
        let isActive = context.id == appState.activeContextID
        let isSelected = index == selectedIndex

        return Button {
            switchToContext(context)
        } label: {
            HStack(spacing: 10) {
                // Context color dot
                Circle()
                    .fill(Color(hex: context.color) ?? .blue)
                    .frame(width: 10, height: 10)

                // Context name
                Text(context.name)
                    .font(.system(size: 14))
                    .fontWeight(isActive ? .semibold : .regular)

                Spacer()

                // Window count
                if context.windowSnapshots.count > 0 {
                    Text("\(context.liveWindowCount)w")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .monospacedDigit()
                }

                // Active indicator
                if isActive {
                    Image(systemName: "checkmark")
                        .font(.caption.bold())
                        .foregroundStyle(.green)
                }
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 7)
            .background(
                RoundedRectangle(cornerRadius: 6)
                    .fill(isSelected ? Color.accentColor.opacity(0.2) : Color.clear)
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    // MARK: - Actions

    /// Confirms the current selection and switches to the highlighted context.
    private func confirmSelection() {
        guard !filteredContexts.isEmpty,
              selectedIndex < filteredContexts.count else { return }
        switchToContext(filteredContexts[selectedIndex])
    }

    /// Switches to the given context and dismisses the picker.
    private func switchToContext(_ context: SystemWindowContext) {
        appState.switchContext(to: context.id)
        appState.dismissContextPicker()
    }

    /// Moves the selection up one row.
    public func moveSelectionUp() {
        guard !filteredContexts.isEmpty else { return }
        selectedIndex = (selectedIndex - 1 + filteredContexts.count) % filteredContexts.count
    }

    /// Moves the selection down one row.
    public func moveSelectionDown() {
        guard !filteredContexts.isEmpty else { return }
        selectedIndex = (selectedIndex + 1) % filteredContexts.count
    }
}
