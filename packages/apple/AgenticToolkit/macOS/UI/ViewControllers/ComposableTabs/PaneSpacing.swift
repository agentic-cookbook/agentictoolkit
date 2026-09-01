import AppKit

import AgenticToolkitCore
import AgenticToolkitCoreMacOS

/// How much room a project window keeps around and between its panes.
///
/// Six numbers: the four insets between the pane area and the tab bars framing
/// it, and the two gutters — one for panes side by side, one for panes stacked.
/// A gutter is the whole gap, not each pane's half, which is why it is stored
/// once rather than as a per-pane inset: ten means ten points between two panes.
///
/// App-wide, deliberately. A window whose panes are spaced differently from the
/// window beside it reads as a bug, and per-window spacing would have to be
/// carried in every saved layout to survive a relaunch.
@MainActor
public enum PaneSpacing {

    public static var current: Spacing {
        var spacing = Spacing()
        for (edge, setting) in edgeSettings {
            spacing[edge] = setting.value
        }
        for (gutter, setting) in gutterSettings {
            spacing[gutter] = setting.value
        }
        return spacing
    }

    public static let edgeSettings: [SpacingEdge: UserSetting<Int>] = [
        .top: UserSettings.paneSpacingTop,
        .leading: UserSettings.paneSpacingLeading,
        .bottom: UserSettings.paneSpacingBottom,
        .trailing: UserSettings.paneSpacingTrailing
    ]

    public static let gutterSettings: [SpacingGutter: UserSetting<Int>] = [
        .betweenColumns: UserSettings.paneSpacingBetweenColumns,
        .betweenRows: UserSettings.paneSpacingBetweenRows
    ]

    /// Every key above, so one observer can recognize a change to any of them
    /// from `UserSettings.shared.changes`.
    public static let settingKeys: Set<String> = Set(
        edgeSettings.values.map(\.name) + gutterSettings.values.map(\.name)
    )

    /// The insets, as AppKit wants them.
    public static var contentInsets: NSEdgeInsets {
        let spacing = current
        return NSEdgeInsets(
            top: CGFloat(spacing.top),
            left: CGFloat(spacing.leading),
            bottom: CGFloat(spacing.bottom),
            right: CGFloat(spacing.trailing)
        )
    }

    /// How wide a divider stays draggable, however narrow the gutter is drawn.
    /// A zero-point gutter is a legitimate look, and it would otherwise be a
    /// layout the user cannot undo with the mouse.
    public static let minimumDividerGrab: CGFloat = 6
}

/// The split view behind a project window's panes.
///
/// Two overrides, both for the same reason: a divider here is a *gap*, not a
/// seam. Its thickness is the gutter the user asked for, and once it is wider
/// than a hairline it is painted as window background — a ten-point bar in the
/// divider colour would be a stripe between the panes rather than space.
@MainActor
public final class PaneSplitView: ThemedSplitView {

    /// A vertical split view stands its panes side by side, so its divider is
    /// the gap between two columns; a horizontal one stacks them.
    public override var dividerThickness: CGFloat {
        CGFloat(isVertical ? PaneSpacing.current.betweenColumns : PaneSpacing.current.betweenRows)
    }

    public override func drawDivider(in rect: NSRect) {
        guard dividerThickness > 1 else {
            super.drawDivider(in: rect)
            return
        }
        currentPalette.nsColor(.windowBackground).setFill()
        rect.fill()
    }

    /// Re-reads the gutter after the setting changes. `dividerThickness` is
    /// computed, so nothing tells AppKit on its own that the answer moved.
    ///
    /// `adjustSubviews()` is the resize-based layout path, and an
    /// `NSSplitViewController` lays its panes out with constraints instead —
    /// constraints whose constants were built from `dividerThickness` when the
    /// items were installed. Assigning the divider style is what makes AppKit
    /// throw those away and ask again, so the style is toggled off its current
    /// value and back rather than left alone.
    public func spacingDidChange() {
        let style = dividerStyle
        dividerStyle = style == .thin ? .paneSplitter : .thin
        dividerStyle = style
        needsDisplay = true
    }
}

extension UserSettings {

    /// Space between the pane area and the tab bars framing it, per side, in
    /// points. Zero by default: the gap is an option, not the house style.
    static public var paneSpacingTop = UserSetting<Int>("pane_spacing_top", default: 0)
    static public var paneSpacingLeading = UserSetting<Int>("pane_spacing_leading", default: 0)
    static public var paneSpacingBottom = UserSetting<Int>("pane_spacing_bottom", default: 0)
    static public var paneSpacingTrailing = UserSetting<Int>("pane_spacing_trailing", default: 0)

    /// The gap between two panes, in points — the whole gap, shared by both.
    /// One point by default, which is the hairline divider windows have always
    /// had, so nothing re-spaces itself on the update that adds this.
    static public var paneSpacingBetweenColumns = UserSetting<Int>("pane_spacing_between_columns", default: 1)
    static public var paneSpacingBetweenRows = UserSetting<Int>("pane_spacing_between_rows", default: 1)
}
