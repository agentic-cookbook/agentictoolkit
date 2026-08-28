import AppKit
import AgenticToolkitCore
import AgenticToolkitCoreMacOS

@MainActor
public enum NestedContentRegistry {

    public typealias Factory = @MainActor (
        _ nodeID: UUID,
        _ document: NestedSplitViewDocument,
        _ paneNumber: Int
    ) -> NSView

    public static let placeholderIdentifier = "whippet.placeholder"

    private static var factories: [String: Factory] = [:]
    private static var registeredDefaults = false

    public static func registerDefaultsIfNeeded() {
        guard !registeredDefaults else { return }
        registeredDefaults = true
        register(placeholderIdentifier) { _, _, paneNumber in
            makePlaceholderView(paneNumber: paneNumber)
        }
    }

    public static func register(_ identifier: String, _ factory: @escaping Factory) {
        factories[identifier] = factory
    }

    public static func makeView(
        for identifier: String,
        nodeID: UUID,
        document: NestedSplitViewDocument,
        paneNumber: Int
    ) -> NSView {
        registerDefaultsIfNeeded()
        if let factory = factories[identifier] {
            return factory(nodeID, document, paneNumber)
        }
        return makePlaceholderView(paneNumber: paneNumber)
    }

    // MARK: - Placeholder

    private static func makePlaceholderView(paneNumber: Int) -> NSView {
        let container = NSView(frame: NSRect(x: 0, y: 0, width: 300, height: 200))
        container.wantsLayer = true
        // The panes are told apart by their tints, so this wants the palette's
        // chart-series colors — the set whose job is to be mutually distinct —
        // rather than a fixed list of system hues no theme reaches.
        container.observeTheme { view, palette in
            let series = palette.chartSeriesNSColors
            guard !series.isEmpty else { return }
            let tint = series[(paneNumber - 1) % series.count]
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
        return container
    }
}
