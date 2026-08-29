import AppKit
import AgenticToolkitCore
import AgenticToolkitCoreMacOS

/// Adopted by pane content that holds live resources — child processes, file
/// system watchers — so closing the pane releases them at that moment instead
/// of whenever the last reference happens to go. Optional: content with nothing
/// to tear down simply doesn't adopt it.
@MainActor
public protocol PaneContentTeardown: AnyObject {
    func paneContentWillBeDiscarded()
}

@MainActor
public enum NestedContentRegistry {

    /// Factories vend a view controller, not a bare view: `NestedViewController`
    /// adopts it as a child, which is what puts the content in the responder
    /// chain, delivers its appearance callbacks, and keeps it alive. A factory
    /// that returned a view would leave its owner unowned and its
    /// `viewWillAppear` silent.
    public typealias Factory = @MainActor (
        _ nodeID: UUID,
        _ document: NestedSplitViewDocument,
        _ paneNumber: Int
    ) -> NSViewController

    /// Sizing facts a pane's content needs at install time, because
    /// `NSSplitViewItem` wants them before the view has any content to measure.
    /// Deliberately only the two fields that keep a sidebar from claiming half
    /// the window — a forerunner of the full view descriptor in phase 5 of the
    /// ComposableTabs refactor, not a general-purpose layout language.
    public struct PaneMetrics: Sendable {
        /// Minimum width (or height) of the pane, in points.
        public var minimumThickness: CGFloat
        /// Share of the enclosing split the pane asks for on first layout.
        /// `nil` means "no preference" — the split divides evenly.
        public var preferredThicknessFraction: CGFloat?

        public init(minimumThickness: CGFloat = 120, preferredThicknessFraction: CGFloat? = nil) {
            self.minimumThickness = minimumThickness
            self.preferredThicknessFraction = preferredThicknessFraction
        }

        public static let `default` = PaneMetrics()
    }

    /// Not `@MainActor`: `DocumentLayoutBlueprint` reaches for it from the
    /// document's off-main writer. A `let String` is safe anywhere.
    public nonisolated static let placeholderIdentifier = "whippet.placeholder"

    private static var factories: [String: Factory] = [:]
    private static var metricsByIdentifier: [String: PaneMetrics] = [:]
    private static var registeredDefaults = false

    public static func registerDefaultsIfNeeded() {
        guard !registeredDefaults else { return }
        registeredDefaults = true
        register(placeholderIdentifier) { _, _, paneNumber in
            PlaceholderPaneViewController(paneNumber: paneNumber)
        }
    }

    public static func register(
        _ identifier: String,
        metrics: PaneMetrics = .default,
        _ factory: @escaping Factory
    ) {
        factories[identifier] = factory
        metricsByIdentifier[identifier] = metrics
    }

    /// Falls back to `.default` for unregistered identifiers, which are the
    /// same ones `makeView(for:...)` answers with a placeholder.
    public static func metrics(for identifier: String) -> PaneMetrics {
        registerDefaultsIfNeeded()
        return metricsByIdentifier[identifier] ?? .default
    }

    /// An unregistered identifier gets the placeholder rather than an error —
    /// a document can legitimately name content the running app doesn't have,
    /// and losing the pane would lose the layout with it.
    public static func makeContentViewController(
        for identifier: String,
        nodeID: UUID,
        document: NestedSplitViewDocument,
        paneNumber: Int
    ) -> NSViewController {
        registerDefaultsIfNeeded()
        if let factory = factories[identifier] {
            return factory(nodeID, document, paneNumber)
        }
        return PlaceholderPaneViewController(paneNumber: paneNumber)
    }
}

// MARK: - Placeholder

/// The numbered, tinted rectangle a pane shows when its content type is the
/// placeholder — or when the document names content this app doesn't register.
@MainActor
public final class PlaceholderPaneViewController: NSViewController {

    private let paneNumber: Int

    public init(paneNumber: Int) {
        self.paneNumber = paneNumber
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    public required init?(coder: NSCoder) {
        fatalError("init(coder:) is not supported")
    }

    public override func loadView() {
        let container = NSView(frame: NSRect(x: 0, y: 0, width: 300, height: 200))
        container.wantsLayer = true
        // The panes are told apart by their tints, so this wants the palette's
        // chart-series colors — the set whose job is to be mutually distinct —
        // rather than a fixed list of system hues no theme reaches.
        let number = paneNumber
        container.observeTheme { view, palette in
            let series = palette.chartSeriesNSColors
            guard !series.isEmpty else { return }
            let tint = series[(number - 1) % series.count]
            view.layer?.backgroundColor = tint.withAlphaComponent(0.15).cgColor
        }

        let title = ThemedLabel(
            string: "Pane \(paneNumber)", role: .primaryText, textRole: .heading)
        title.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(title)
        NSLayoutConstraint.activate([
            title.centerXAnchor.constraint(equalTo: container.centerXAnchor),
            title.centerYAnchor.constraint(equalTo: container.centerYAnchor)
        ])
        view = container
    }
}
