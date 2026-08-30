import AppKit
import AgenticToolkitCore
import AgenticToolkitCoreMacOS

/// The view set and layout rules the demo document uses.
///
/// Its whole reason to exist is to make `ComposableTabLayoutSpec` visible: six
/// views with deliberately different cardinalities and preferred axes, one
/// pinned region, and panes that print the rules governing them. Nothing here
/// is shared with a real app document — that is the point of the registry being
/// an instance rather than a namespace of statics.
@MainActor
public enum ComposableTabsDemo {

    public static let list = ComposableTabsViewID("demo.list")
    public static let terminal = ComposableTabsViewID("demo.terminal")
    public static let editor = ComposableTabsViewID("demo.editor")
    public static let inspector = ComposableTabsViewID("demo.inspector")
    public static let summary = ComposableTabsViewID("demo.summary")

    public static func makeRegistry() -> ComposableTabsViewRegistry {
        let registry = ComposableTabsViewRegistry()

        registry.register(list, descriptor: .init(
            displayName: "List",
            symbolName: "list.bullet",
            preferredAxis: .horizontal,
            minimumThickness: 180,
            preferredThicknessFraction: 0.22
        )) { DemoPaneViewController(context: $0) }

        registry.register(terminal, descriptor: .init(
            displayName: "Terminal",
            symbolName: "terminal",
            preferredAxis: .vertical,
            minimumThickness: 240
        )) { DemoPaneViewController(context: $0) }

        registry.register(editor, descriptor: .init(
            displayName: "Editor",
            symbolName: "doc.text",
            preferredAxis: .horizontal,
            minimumThickness: 280
        )) { DemoPaneViewController(context: $0) }

        registry.register(inspector, descriptor: .init(
            displayName: "Inspector",
            symbolName: "sidebar.right",
            preferredAxis: .horizontal,
            minimumThickness: 200,
            preferredThicknessFraction: 0.2,
            isCollapsible: true
        )) { DemoPaneViewController(context: $0) }

        registry.register(summary, descriptor: .init(
            displayName: "Summary",
            symbolName: "rectangle.3.group",
            preferredAxis: .vertical,
            minimumThickness: 220
        )) { DemoSummaryViewController(context: $0) }

        return registry
    }

    /// A pinned `List` down the left, an `Editor` above a `Terminal` on the
    /// right. The list's region is `isFixed`, so the demo shows a region the
    /// user can neither split nor remove rather than merely defining one.
    public static func makeSpec() -> ComposableTabLayoutSpec {
        .split(
            axis: .horizontal,
            children: [
                .pane(list, isFixed: true),
                .split(axis: .vertical, children: [.pane(editor), .pane(terminal)])
            ],
            allows: [
                .init(list, min: 1, max: 1, preferredAxis: .horizontal),
                .init(inspector, min: 0, max: 1, preferredAxis: .horizontal),
                .init(summary, min: 0, max: 1, preferredAxis: .vertical),
                .unbounded(editor, preferredAxis: .horizontal),
                .unbounded(terminal, preferredAxis: .vertical),
                .unbounded(.placeholder)
            ]
        )
    }

    public static func makeLayout() throws -> ComposableTabsLayout {
        try ComposableTabsLayout(registry: makeRegistry(), spec: makeSpec())
    }
}

/// The demo document controller.
///
/// It is a subclass rather than the copy of `ComposableTabsDocumentController`
/// the original plan called for: the only thing that differs is which layout
/// its documents get, and duplicating two hundred lines of document-lifecycle
/// sequencing would give two places to fix the next bug found in it (`dry`).
public final class ComposableLayoutDocumentControllerDemo: ComposableTabsDocumentController {

    private let demoLayout: ComposableTabsLayout

    @MainActor
    public override init() {
        // The spec names only views `makeRegistry()` registers, so validation
        // cannot fail; if it ever does, that is a programmer error in this file
        // and belongs at launch rather than in a fallback.
        // swiftlint:disable:next force_try
        self.demoLayout = try! ComposableTabsDemo.makeLayout()
        super.init()
    }

    @available(*, unavailable)
    public required init?(coder: NSCoder) {
        fatalError("init(coder:) is not supported")
    }

    public override var documentLayout: ComposableTabsLayout { demoLayout }
}
