import SwiftUI
import AgenticToolkitCore
import AgenticToolkitCoreMacOS

/// Displays unmatched window fingerprints and candidate windows for manual assignment.
///
/// This view appears automatically on launch when the re-matching engine detects
/// dormant snapshots that could not be auto-assigned. Each unmatched fingerprint
/// is shown with its original app, title pattern, and owning context. The user
/// can pick a candidate window to assign, skip the fingerprint, or auto-assign
/// all remaining high-confidence matches.
public struct ReconcileView: View {
    @EnvironmentObject private var appState: SystemWindowContextsModel

    public init() {}

    public var body: some View {
        VStack(spacing: 0) {
            headerSection

            Divider()

            if appState.unmatchedItems.isEmpty {
                allDoneSection
            } else {
                ScrollView {
                    LazyVStack(spacing: 12) {
                        ForEach(appState.unmatchedItems) { item in
                            UnmatchedItemCard(item: item)
                                .environmentObject(appState)
                        }
                    }
                    .padding()
                }
            }

            Divider()

            footerSection
        }
        .frame(minWidth: 550, idealWidth: 600, minHeight: 400, idealHeight: 500)
    }

    // MARK: - Header

    private var headerSection: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Image(systemName: "arrow.triangle.2.circlepath")
                    .font(.title2)
                    .foregroundStyle(.secondary)
                Text("Reconcile Windows")
                    .font(.title2.bold())
                Spacer()
            }

            Text("Some windows could not be automatically matched to their previous " +
                 "\(appState.contextNounPlural). Assign them manually or skip to leave unassigned.")
                .font(.callout)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding()
    }

    // MARK: - All Done

    private var allDoneSection: some View {
        VStack(spacing: 12) {
            Spacer()
            Image(systemName: "checkmark.circle")
                .font(.system(size: 48))
                .foregroundStyle(.green)
            Text("All windows reconciled")
                .font(.headline)
            Text("You can close this window.")
                .font(.callout)
                .foregroundStyle(.secondary)
            Spacer()
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Footer

    private var footerSection: some View {
        HStack {
            let remaining = appState.unmatchedItems.count
            Text("\(remaining) unmatched \(remaining == 1 ? "window" : "windows")")
                .font(.callout)
                .foregroundStyle(.secondary)

            Spacer()

            Button("Auto-assign All") {
                appState.autoAssignAllRemainingMatches()
            }
            .disabled(appState.unmatchedItems.allSatisfy { $0.candidates.isEmpty })

            Button("Dismiss") {
                appState.dismissReconcileWindow()
            }
        }
        .padding()
    }
}

// MARK: - Unmatched Item Card

/// A card showing one unmatched fingerprint with its candidate windows.
struct UnmatchedItemCard: View {
    @EnvironmentObject private var appState: SystemWindowContextsModel
    let item: ReconcileItem

    /// Whether the candidate list is expanded.
    @State private var isExpanded = true

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Fingerprint info header
            HStack(spacing: 8) {
                // Context color dot
                Circle()
                    .fill(Color(hex: item.contextColor) ?? .blue)
                    .frame(width: 10, height: 10)

                VStack(alignment: .leading, spacing: 2) {
                    Text(item.app)
                        .font(.headline)
                    Text(item.titlePattern.isEmpty ? "(no title pattern)" : item.titlePattern)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                Text(item.contextName)
                    .font(.caption)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(
                        Capsule()
                            .fill((Color(hex: item.contextColor) ?? .blue).opacity(0.15))
                    )

                Button("Skip") {
                    appState.skipUnmatchedItem(item.id)
                }
                .buttonStyle(.bordered)
                .controlSize(.small)
            }

            // Candidate windows
            if item.candidates.isEmpty {
                Text("No candidate windows found")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
                    .padding(.leading, 18)
            } else {
                DisclosureGroup(isExpanded: $isExpanded) {
                    VStack(spacing: 4) {
                        ForEach(item.candidates) { candidate in
                            candidateRow(candidate)
                        }
                    }
                } label: {
                    Text("\(item.candidates.count) \(item.candidates.count == 1 ? "candidate" : "candidates")")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(Color(nsColor: .controlBackgroundColor))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .strokeBorder(Color(nsColor: .separatorColor), lineWidth: 0.5)
        )
    }

    /// A single candidate window row with its score and an Assign button.
    private func candidateRow(_ candidate: ReconcileCandidate) -> some View {
        HStack(spacing: 8) {
            VStack(alignment: .leading, spacing: 1) {
                Text(candidate.windowTitle.isEmpty ? "(untitled)" : candidate.windowTitle)
                    .font(.callout)
                    .lineLimit(1)
                Text(candidate.app)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            // Score badge
            scoreBadge(candidate.score)

            Button("Assign") {
                appState.assignWindow(
                    candidateWindowID: candidate.windowID,
                    toUnmatchedItem: item.id
                )
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.small)
        }
        .padding(.vertical, 2)
        .padding(.horizontal, 4)
    }

    /// A colored badge showing the match score.
    private func scoreBadge(_ score: Int) -> some View {
        Text("\(score)")
            .font(.caption.monospacedDigit().bold())
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(
                RoundedRectangle(cornerRadius: 4)
                    .fill(scoreColor(score).opacity(0.15))
            )
            .foregroundStyle(scoreColor(score))
    }

    /// Returns a color appropriate for the given match score.
    private func scoreColor(_ score: Int) -> Color {
        if score >= 80 {
            return .green
        } else if score >= 60 {
            return .orange
        } else {
            return .red
        }
    }
}
