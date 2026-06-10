import SwiftUI
import AgenticToolkitCore
import AgenticToolkitCoreMacOS

/// The Heuristics tab within Settings, showing built-in heuristics and
/// user-configurable custom rules.
///
/// Built-in heuristics (Xcode, Warp, Brave, VS Code, Terminal) are shown
/// as non-deletable defaults. Users can add, edit, and delete custom rules
/// that match app names and title patterns for auto-assignment to contexts.
public struct HeuristicsSettingsTab: View {
    @EnvironmentObject private var appState: SystemWindowContextsModel

    /// Whether the add/edit sheet is showing.
    @State private var showingEditor = false

    /// The rule being edited, or nil for a new rule.
    @State private var editingRule: CustomHeuristicRule?

    /// Whether the delete confirmation alert is showing.
    @State private var ruleToDelete: UUID?

    public init() {}

    public var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Built-in heuristics section
            builtInSection

            Divider()

            // Custom rules section
            customRulesSection
        }
        .padding()
        .sheet(isPresented: $showingEditor) {
            HeuristicRuleEditor(
                rule: editingRule,
                contextNoun: appState.contextNoun,
                contextNames: appState.contexts.map(\.name),
                onSave: { rule in
                    if editingRule != nil {
                        appState.updateCustomHeuristicRule(rule)
                    } else {
                        appState.addCustomHeuristicRule(rule)
                    }
                    showingEditor = false
                    editingRule = nil
                },
                onCancel: {
                    showingEditor = false
                    editingRule = nil
                }
            )
        }
        .alert("Delete Rule?", isPresented: showingDeleteAlert) {
            Button("Cancel", role: .cancel) {
                ruleToDelete = nil
            }
            Button("Delete", role: .destructive) {
                if let id = ruleToDelete {
                    appState.deleteCustomHeuristicRule(id: id)
                    ruleToDelete = nil
                }
            }
        } message: {
            Text("Are you sure you want to delete this heuristic rule?")
        }
    }

    private var showingDeleteAlert: Binding<Bool> {
        Binding(
            get: { ruleToDelete != nil },
            set: { if !$0 { ruleToDelete = nil } }
        )
    }

    // MARK: - Built-in Heuristics

    private var builtInSection: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Built-in Heuristics")
                .font(.headline)
            Text("These are built in and cannot be deleted.")
                .font(.caption)
                .foregroundStyle(.secondary)

            List {
                ForEach(appState.builtInHeuristics, id: \.name) { heuristic in
                    builtInRow(for: heuristic)
                }
            }
            .listStyle(.inset(alternatesRowBackgrounds: true))
            .frame(height: 140)
        }
    }

    private func builtInRow(for heuristic: AppHeuristic) -> some View {
        HStack {
            Image(systemName: "lock.fill")
                .foregroundStyle(.secondary)
                .font(.caption)

            Text(heuristic.name)
                .fontWeight(.medium)

            Spacer()

            Text(heuristic.appNames.joined(separator: ", "))
                .font(.caption)
                .foregroundStyle(.secondary)

            Text(heuristic.recommendedStrategy.displayName)
                .font(.caption2)
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(Color.secondary.opacity(0.15))
                .cornerRadius(4)
        }
        .padding(.vertical, 1)
    }

    // MARK: - Custom Rules

    private var customRulesSection: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("Custom Rules")
                    .font(.headline)
                Spacer()
                Button {
                    editingRule = nil
                    showingEditor = true
                } label: {
                    Image(systemName: "plus")
                }
                .help("Add a custom heuristic rule")
            }

            Text("Custom rules are checked when new windows appear. Rules with auto-assign " +
                 "enabled will automatically add matching windows to the target \(appState.contextNoun).")
                .font(.caption)
                .foregroundStyle(.secondary)

            if appState.customHeuristicRules.isEmpty {
                emptyCustomRulesState
            } else {
                customRulesList
            }
        }
    }

    private var emptyCustomRulesState: some View {
        VStack(spacing: 8) {
            Spacer()
            Image(systemName: "wand.and.stars")
                .font(.system(size: 28))
                .foregroundStyle(.secondary)
            Text("No custom rules yet")
                .font(.callout)
                .foregroundStyle(.secondary)
            Text("Add a rule to automatically match windows by app name and title pattern.")
                .font(.caption)
                .foregroundStyle(.tertiary)
                .multilineTextAlignment(.center)
            Spacer()
        }
        .frame(maxWidth: .infinity)
        .frame(height: 120)
    }

    private var customRulesList: some View {
        List {
            ForEach(appState.customHeuristicRules) { rule in
                customRuleRow(for: rule)
            }
        }
        .listStyle(.inset(alternatesRowBackgrounds: true))
        .frame(minHeight: 100, maxHeight: 200)
    }

    private func customRuleRow(for rule: CustomHeuristicRule) -> some View {
        HStack(spacing: 8) {
            VStack(alignment: .leading, spacing: 2) {
                Text(rule.name)
                    .fontWeight(.medium)
                HStack(spacing: 4) {
                    Text(rule.appName)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Text("/")
                        .font(.caption2)
                        .foregroundStyle(.quaternary)
                    Text(rule.titlePattern)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }

            Spacer()

            // Match mode badge
            Text(rule.matchMode.displayName)
                .font(.caption2)
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(Color.secondary.opacity(0.15))
                .cornerRadius(4)

            // Auto-assign indicator
            if rule.autoAssign {
                HStack(spacing: 2) {
                    Image(systemName: "bolt.fill")
                        .font(.caption2)
                    if let target = rule.targetContextName {
                        Text(target)
                            .font(.caption2)
                            .lineLimit(1)
                    }
                }
                .foregroundStyle(.blue)
            }

            // Edit button
            Button {
                editingRule = rule
                showingEditor = true
            } label: {
                Image(systemName: "pencil")
            }
            .buttonStyle(.borderless)
            .help("Edit rule")

            // Delete button
            Button {
                ruleToDelete = rule.id
            } label: {
                Image(systemName: "trash")
                    .foregroundStyle(.red)
            }
            .buttonStyle(.borderless)
            .help("Delete rule")
        }
        .padding(.vertical, 2)
    }
}

// MARK: - Heuristic Rule Editor

/// A sheet view for adding or editing a custom heuristic rule.
struct HeuristicRuleEditor: View {
    /// The rule being edited, or nil for a new rule.
    let rule: CustomHeuristicRule?

    /// Host-supplied singular noun for a context (e.g. "Hairball").
    let contextNoun: String

    /// Available context names for the auto-assign target picker.
    let contextNames: [String]

    /// Called when the user saves the rule.
    let onSave: (CustomHeuristicRule) -> Void

    /// Called when the user cancels.
    let onCancel: () -> Void

    @State private var name: String = ""
    @State private var appName: String = ""
    @State private var titlePattern: String = ""
    @State private var matchMode: CustomMatchMode = .substring
    @State private var autoAssign: Bool = false
    @State private var targetContextName: String = ""

    var body: some View {
        VStack(spacing: 0) {
            // Header
            HStack {
                Text(rule != nil ? "Edit Heuristic Rule" : "New Heuristic Rule")
                    .font(.headline)
                Spacer()
            }
            .padding()

            Divider()

            // Form
            Form {
                Section("Rule Details") {
                    TextField("Rule Name:", text: $name)
                        .help("A descriptive name for this rule")

                    TextField("App Name:", text: $appName)
                        .help("The application name to match (e.g., \"Safari\", \"Firefox\")")

                    TextField("Title Pattern:", text: $titlePattern)
                        .help("The pattern to match in window titles")

                    Picker("Match Mode:", selection: $matchMode) {
                        ForEach(CustomMatchMode.allCases, id: \.self) { mode in
                            Text(mode.displayName).tag(mode)
                        }
                    }
                    .pickerStyle(.segmented)
                }

                Section("Auto-Assignment") {
                    Toggle("Auto-assign matching windows", isOn: $autoAssign)
                        .help("When enabled, new windows matching this rule will be " +
                              "automatically added to the target \(contextNoun).")

                    if autoAssign {
                        Picker("Target \(contextNoun):", selection: $targetContextName) {
                            Text("None").tag("")
                            ForEach(contextNames, id: \.self) { name in
                                Text(name).tag(name)
                            }
                        }
                    }
                }
            }
            .formStyle(.grouped)

            Divider()

            // Buttons
            HStack {
                Button("Cancel", action: onCancel)
                    .keyboardShortcut(.cancelAction)
                Spacer()
                Button("Save") {
                    saveRule()
                }
                .keyboardShortcut(.defaultAction)
                .disabled(appName.isEmpty || titlePattern.isEmpty)
            }
            .padding()
        }
        .frame(width: 420, height: 400)
        .onAppear {
            if let rule = rule {
                name = rule.name
                appName = rule.appName
                titlePattern = rule.titlePattern
                matchMode = rule.matchMode
                autoAssign = rule.autoAssign
                targetContextName = rule.targetContextName ?? ""
            }
        }
    }

    private func saveRule() {
        let ruleName = name.isEmpty ? "\(appName) - \(titlePattern)" : name
        let savedRule = CustomHeuristicRule(
            id: rule?.id ?? UUID(),
            appName: appName.trimmingCharacters(in: .whitespaces),
            titlePattern: titlePattern.trimmingCharacters(in: .whitespaces),
            matchMode: matchMode,
            autoAssign: autoAssign,
            targetContextName: autoAssign && !targetContextName.isEmpty ? targetContextName : nil,
            name: ruleName.trimmingCharacters(in: .whitespaces),
            createdAt: rule?.createdAt ?? Date()
        )
        onSave(savedRule)
    }
}

// MARK: - MatchStrategy Display Extension

extension MatchStrategy {
    /// Human-readable display name for each strategy.
    var displayName: String {
        switch self {
        case .appAndTitleExact: return "Exact"
        case .appAndTitleSubstring: return "Substring"
        case .appAndTitleRegex: return "Regex"
        case .appOnly: return "App Only"
        }
    }
}
