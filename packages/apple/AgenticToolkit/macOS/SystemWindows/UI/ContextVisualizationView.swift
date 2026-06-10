import SwiftUI
import AgenticToolkitCore
import AgenticToolkitCoreMacOS

/// A grid of Hairball cards that visualizes each Hairball's windows as miniature
/// rectangles positioned proportionally to the display layout.
///
/// Each card shows:
/// - The Hairball name and color
/// - A miniature representation of the display(s) with window rectangles
/// - The active Hairball is visually distinguished with a highlighted border
///
/// This view is embedded in the Settings Hairballs tab.
public struct ContextVisualizationView: View {
    @EnvironmentObject private var appState: SystemWindowContextsModel

    /// The grid layout: adaptive columns that fit cards nicely.
    private let columns = [
        GridItem(.adaptive(minimum: 200, maximum: 280), spacing: 12)
    ]

    public init() {}

    public var body: some View {
        if appState.contexts.isEmpty {
            emptyState
        } else {
            ScrollView {
                LazyVGrid(columns: columns, spacing: 12) {
                    ForEach(appState.contexts) { context in
                        ContextCard(
                            context: context,
                            isActive: context.id == appState.activeContextID
                        )
                    }
                }
                .padding()
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: 12) {
            Spacer()
            Image(systemName: "rectangle.3.group")
                .font(.system(size: 36))
                .foregroundStyle(.secondary)
            Text("No \(appState.contextNounPlural) to visualize")
                .font(.headline)
                .foregroundStyle(.secondary)
            Text("Create a \(appState.contextNoun) from the menu bar to see window layouts here.")
                .font(.callout)
                .foregroundStyle(.tertiary)
                .multilineTextAlignment(.center)
            Spacer()
        }
        .frame(maxWidth: .infinity)
    }
}

// MARK: - Context Card

/// A single card showing a Hairball's name, color, and miniature window layout.
struct ContextCard: View {
    let context: SystemWindowContext
    let isActive: Bool

    /// The height for the display preview area.
    private let previewHeight: CGFloat = 120

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Header: color dot + name + window count
            HStack(spacing: 8) {
                Circle()
                    .fill(Color(hex: context.color) ?? .blue)
                    .frame(width: 10, height: 10)

                Text(context.name)
                    .font(.headline)
                    .lineLimit(1)

                Spacer()

                let liveCount = context.liveWindowCount
                let totalCount = context.windowSnapshots.count
                if totalCount > 0 {
                    Text("\(liveCount)/\(totalCount)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .monospacedDigit()
                }

                if isActive {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(.green)
                        .font(.caption)
                }
            }

            // Display preview with miniature window rectangles
            displayPreview
                .frame(height: previewHeight)
                .clipShape(RoundedRectangle(cornerRadius: 6))
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 10)
                .fill(Color(nsColor: .controlBackgroundColor))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 10)
                .strokeBorder(
                    isActive
                        ? (Color(hex: context.color) ?? .blue)
                        : Color(nsColor: .separatorColor),
                    lineWidth: isActive ? 2 : 0.5
                )
        )
    }

    // MARK: - Display Preview

    /// Renders a miniature view of the display area with window rectangles
    /// positioned proportionally.
    private var displayPreview: some View {
        GeometryReader { geo in
            let snapshots = context.windowSnapshots
            let bounds = computeDisplayBounds(snapshots: snapshots)
            let scale = computeScale(bounds: bounds, viewSize: geo.size)

            ZStack(alignment: .topLeading) {
                // Background representing the display area
                RoundedRectangle(cornerRadius: 4)
                    .fill(Color(nsColor: .windowBackgroundColor).opacity(0.5))

                // Display boundary outlines
                ForEach(Array(distinctDisplays(snapshots: snapshots).enumerated()), id: \.offset) { _, displayRect in
                    let scaled = scaleRect(displayRect, bounds: bounds, scale: scale, viewSize: geo.size)
                    RoundedRectangle(cornerRadius: 2)
                        .strokeBorder(Color(nsColor: .separatorColor), lineWidth: 0.5)
                        .frame(width: scaled.width, height: scaled.height)
                        .offset(x: scaled.minX, y: scaled.minY)
                }

                // Window rectangles
                ForEach(snapshots) { snapshot in
                    let scaled = scaleRect(snapshot.savedFrame, bounds: bounds, scale: scale, viewSize: geo.size)
                    RoundedRectangle(cornerRadius: 2)
                        .fill((Color(hex: context.color) ?? .blue).opacity(0.3))
                        .overlay(
                            RoundedRectangle(cornerRadius: 2)
                                .strokeBorder((Color(hex: context.color) ?? .blue).opacity(0.6), lineWidth: 1)
                        )
                        .overlay(
                            Text(snapshot.app)
                                .font(.system(size: 7))
                                .lineLimit(1)
                                .foregroundStyle(.secondary)
                                .padding(2)
                            , alignment: .topLeading
                        )
                        .frame(width: max(scaled.width, 10), height: max(scaled.height, 8))
                        .offset(x: scaled.minX, y: scaled.minY)
                }

                // "No windows" label if the context has no snapshots
                if snapshots.isEmpty {
                    VStack {
                        Spacer()
                        HStack {
                            Spacer()
                            Text("No windows")
                                .font(.caption)
                                .foregroundStyle(.tertiary)
                            Spacer()
                        }
                        Spacer()
                    }
                }
            }
        }
    }

    // MARK: - Layout Computation

    /// Computes the bounding rectangle that encompasses all window frames
    /// and display areas.
    private func computeDisplayBounds(snapshots: [SystemWindowSnapshot]) -> CGRect {
        guard !snapshots.isEmpty else {
            // Default to a single-display-sized area
            return CGRect(x: 0, y: 0, width: 1920, height: 1080)
        }

        var minX = CGFloat.infinity
        var minY = CGFloat.infinity
        var maxX = -CGFloat.infinity
        var maxY = -CGFloat.infinity

        for snapshot in snapshots {
            let frame = snapshot.savedFrame
            minX = min(minX, frame.minX)
            minY = min(minY, frame.minY)
            maxX = max(maxX, frame.maxX)
            maxY = max(maxY, frame.maxY)
        }

        // Ensure we have a reasonable minimum size
        let width = max(maxX - minX, 800)
        let height = max(maxY - minY, 400)

        return CGRect(x: minX, y: minY, width: width, height: height)
    }

    /// Computes the scale factor to fit the display bounds into the view.
    private func computeScale(bounds: CGRect, viewSize: CGSize) -> CGFloat {
        guard bounds.width > 0 && bounds.height > 0 else { return 1 }

        let padding: CGFloat = 8
        let availableWidth = viewSize.width - padding * 2
        let availableHeight = viewSize.height - padding * 2

        let scaleX = availableWidth / bounds.width
        let scaleY = availableHeight / bounds.height

        return min(scaleX, scaleY)
    }

    /// Scales a rectangle from display coordinates to view coordinates.
    private func scaleRect(_ rect: CGRect, bounds: CGRect, scale: CGFloat, viewSize: CGSize) -> CGRect {
        let padding: CGFloat = 8
        let scaledBoundsWidth = bounds.width * scale
        let scaledBoundsHeight = bounds.height * scale
        let offsetX = padding + (viewSize.width - padding * 2 - scaledBoundsWidth) / 2
        let offsetY = padding + (viewSize.height - padding * 2 - scaledBoundsHeight) / 2

        return CGRect(
            x: (rect.minX - bounds.minX) * scale + offsetX,
            y: (rect.minY - bounds.minY) * scale + offsetY,
            width: rect.width * scale,
            height: rect.height * scale
        )
    }

    /// Returns distinct display rectangles based on snapshot display IDs.
    ///
    /// Since we don't have access to live NSScreen data in this view,
    /// we approximate each display's bounds from the snapshots that belong to it.
    private func distinctDisplays(snapshots: [SystemWindowSnapshot]) -> [CGRect] {
        let displayGroups = Dictionary(grouping: snapshots, by: { $0.display })
        guard !displayGroups.isEmpty else { return [] }

        return displayGroups.map { _, groupSnapshots in
            var minX = CGFloat.infinity
            var minY = CGFloat.infinity
            var maxX = -CGFloat.infinity
            var maxY = -CGFloat.infinity

            for snapshot in groupSnapshots {
                let frame = snapshot.savedFrame
                minX = min(minX, frame.minX)
                minY = min(minY, frame.minY)
                maxX = max(maxX, frame.maxX)
                maxY = max(maxY, frame.maxY)
            }

            return CGRect(x: minX, y: minY, width: maxX - minX, height: maxY - minY)
        }
    }
}
