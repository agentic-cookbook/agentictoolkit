import AppKit

/// One line with a view pinned to each end:
///
///     7D QUOTA                                              82.0%
///
/// Built from explicit constraints rather than an `NSStackView` because a stack
/// hands surplus width to whichever arranged view hugs its content least — and
/// when the ends tie (a label and a value both willing to stretch) it hands the
/// surplus to the gap outside them instead, flushing the whole line against one
/// edge. A line whose ends are pinned to the edges is exactly what a card
/// masthead or a table row is; saying so directly is both shorter and immune to
/// that tie.
@MainActor
public enum PinnedEndsLine {

    /// How the two ends line up vertically.
    public enum Alignment {
        /// Share a text baseline — right for two pieces of text at different
        /// sizes, where matching their boxes would leave the smaller floating.
        case firstBaseline
        /// Share a centre — right when one end isn't text (a pill, a symbol).
        case centerY
    }

    /// A container sized to the taller end, with `leading` at its left edge and
    /// `trailing` at its right, never closer than `minimumGap` apart.
    public static func make(
        leading: NSView,
        trailing: NSView,
        minimumGap: CGFloat = 8,
        alignment: Alignment = .firstBaseline
    ) -> NSView {
        let container = NSView()
        container.translatesAutoresizingMaskIntoConstraints = false
        leading.translatesAutoresizingMaskIntoConstraints = false
        trailing.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(leading)
        container.addSubview(trailing)

        var constraints: [NSLayoutConstraint] = [
            leading.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            trailing.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            trailing.leadingAnchor.constraint(
                greaterThanOrEqualTo: leading.trailingAnchor, constant: minimumGap
            )
        ]
        // Each end is bounded by the container without pinning to it, so the
        // container settles at the height of the taller one — the fitting size a
        // vertical stack asks for.
        for end in [leading, trailing] {
            constraints.append(end.topAnchor.constraint(greaterThanOrEqualTo: container.topAnchor))
            constraints.append(
                end.bottomAnchor.constraint(lessThanOrEqualTo: container.bottomAnchor)
            )
        }
        // Inequalities alone leave the height free to grow; this pulls it down
        // onto them, so the container settles exactly on the taller end instead
        // of being ambiguous in a stack that has no height to give it.
        let collapse = container.heightAnchor.constraint(equalToConstant: 0)
        collapse.priority = .defaultLow
        constraints.append(collapse)

        switch alignment {
        case .firstBaseline:
            constraints.append(
                leading.firstBaselineAnchor.constraint(equalTo: trailing.firstBaselineAnchor)
            )
        case .centerY:
            constraints.append(
                leading.centerYAnchor.constraint(equalTo: trailing.centerYAnchor)
            )
        }
        NSLayoutConstraint.activate(constraints)
        return container
    }
}
