import AppKit
import AgenticToolkitCore
import AgenticToolkitCoreMacOS

/// A demo pane that renders the rules governing it.
///
/// The split/remove rules are invisible until something prints them, so every
/// demo view shows its display name, identifier, preferred axis, the axis it is
/// actually sitting on, its pane number, and the `min`/`max` allowance in force
/// where it sits. Exercising the spec then means reading the pane, not reading
/// the debugger.
@MainActor
public class DemoPaneViewController: NSViewController {

    let context: ComposableTabsViewContext
    private let titleLabel: ThemedLabel
    private let detailLabel: ThemedLabel

    public init(context: ComposableTabsViewContext) {
        self.context = context
        self.titleLabel = ThemedLabel(
            string: context.descriptor.displayName, role: .primaryText, textRole: .heading)
        self.detailLabel = ThemedLabel(string: "", role: .secondaryText, textRole: .body)
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    public required init?(coder: NSCoder) {
        fatalError("init(coder:) is not supported")
    }

    public override func loadView() {
        let container = NSView(frame: NSRect(x: 0, y: 0, width: 300, height: 200))
        container.wantsLayer = true

        // Panes are told apart by tint, so this wants the palette's chart
        // series — the set whose job is to be mutually distinct.
        let number = context.paneNumber
        container.observeTheme { view, palette in
            let series = palette.chartSeriesNSColors
            guard !series.isEmpty else { return }
            view.layer?.backgroundColor = series[(number - 1) % series.count]
                .withAlphaComponent(0.12).cgColor
        }

        detailLabel.lineBreakMode = .byWordWrapping
        detailLabel.usesSingleLineMode = false
        detailLabel.maximumNumberOfLines = 0

        let stack = NSStackView(views: [titleLabel, detailLabel])
        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = 6
        stack.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(stack)

        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: 16),
            stack.trailingAnchor.constraint(lessThanOrEqualTo: container.trailingAnchor, constant: -48),
            stack.topAnchor.constraint(equalTo: container.topAnchor, constant: 16)
        ])

        self.view = container
    }

    /// The enclosing split only exists once this controller has been adopted,
    /// so the actual axis and the live allowance are read here rather than in
    /// `loadView`, and again on every appearance — a pane can move when a
    /// sibling collapses.
    public override func viewWillAppear() {
        super.viewWillAppear()
        refresh()
    }

    func refresh() {
        detailLabel.stringValue = detailLines().joined(separator: "\n")
    }

    func detailLines() -> [String] {
        var lines = [
            "id: \(context.viewID.rawValue)",
            "pane: \(context.paneNumber)",
            "prefers: \(context.descriptor.preferredAxis.rawValue)",
            "sitting on: \(enclosingAxis?.rawValue ?? "—")"
        ]
        if let allowance {
            let max = allowance.max.map(String.init) ?? "unbounded"
            lines.append("allowance: min \(allowance.min), max \(max)")
        } else {
            lines.append("allowance: not allowed here")
        }
        if isFixed {
            lines.append("region: fixed — cannot split or remove")
        }
        return lines
    }

    /// The axis of the split this pane's leaf actually sits in, which is the
    /// interesting half of "prefers vertical, is sitting horizontally".
    var enclosingAxis: ComposableTabsAxis? {
        (parent?.parent as? ComposableTabsViewController)?.axis
    }

    var tabTree: LayoutNode? {
        (parent?.parent as? ComposableTabsViewController)?.rootSplit()?.snapshotNode()
    }

    var allowance: ComposableTabsViewAllowance? {
        guard let tabTree else { return nil }
        return context.document.layout.spec.allowance(
            for: context.viewID, at: context.nodeID, in: tabTree)
    }

    var isFixed: Bool {
        guard let tabTree else { return false }
        return context.document.layout.spec.isFixed(context.nodeID, in: tabTree)
    }
}

/// A demo view whose subject is the tab itself: it prints the live layout tree,
/// so splitting or removing a pane anywhere in the tab is visible as a change
/// in text rather than only as a change in geometry.
@MainActor
public final class DemoSummaryViewController: DemoPaneViewController {

    public override func detailLines() -> [String] {
        var lines = super.detailLines()
        lines.append("")
        lines.append("tab layout:")
        if let tabTree {
            lines.append(contentsOf: Self.outline(tabTree, depth: 0))
        } else {
            lines.append("  (not installed yet)")
        }
        return lines
    }

    private static func outline(_ node: LayoutNode, depth: Int) -> [String] {
        let indent = String(repeating: "  ", count: depth + 1)
        switch node.kind {
        case .leaf(let viewID, _):
            return ["\(indent)• \(viewID.rawValue)"]
        case .split(let axis, let first, let second):
            return ["\(indent)\(axis.rawValue)"]
                + outline(first, depth: depth + 1)
                + outline(second, depth: depth + 1)
        }
    }
}
