import XCTest
import AppKit
import AgenticToolkitMacOS

/// What an app gets to say about a document's panes: which content types exist,
/// how wide each one wants to be, and what a fresh tab starts out holding.
///
/// The registry and the blueprint are process-global, so every test here uses
/// identifiers unique to itself and puts the blueprint back in `tearDown`.
@MainActor
final class DocumentPaneContentTests: XCTestCase {

    private lazy var document = NestedSplitViewDocument()

    nonisolated override func tearDown() {
        // `tearDown` is nonisolated; the blueprint's setter is not isolated
        // either, which is the whole point of it.
        DocumentLayoutBlueprint.setProvider(nil)
        super.tearDown()
    }

    private func leafContentTypes(in node: LayoutNode) -> [String] {
        switch node.kind {
        case .leaf(let contentType, _):
            return [contentType]
        case .split(_, let first, let second):
            return leafContentTypes(in: first) + leafContentTypes(in: second)
        }
    }

    private func orientation(of node: LayoutNode) -> String? {
        if case .split(let orientation, _, _) = node.kind { return orientation }
        return nil
    }

    // MARK: - Blueprint

    func testDefaultBlueprintIsTwoPlaceholdersSideBySide() {
        let layout = DocumentLayoutBlueprint.makeTabLayout()
        XCTAssertEqual(orientation(of: layout), "horizontal")
        XCTAssertEqual(
            leafContentTypes(in: layout),
            [NestedContentRegistry.placeholderIdentifier, NestedContentRegistry.placeholderIdentifier]
        )
    }

    func testInstalledProviderReplacesTheDefaultLayout() {
        DocumentLayoutBlueprint.setProvider {
            LayoutNode.split(
                orientation: "vertical",
                first: LayoutNode.leaf(contentType: "test.blueprint.top"),
                second: LayoutNode.leaf(contentType: "test.blueprint.bottom")
            )
        }
        let layout = DocumentLayoutBlueprint.makeTabLayout()
        XCTAssertEqual(orientation(of: layout), "vertical")
        XCTAssertEqual(
            leafContentTypes(in: layout),
            ["test.blueprint.top", "test.blueprint.bottom"]
        )
    }

    func testClearingTheProviderRestoresTheDefaultLayout() {
        DocumentLayoutBlueprint.setProvider {
            LayoutNode.leaf(contentType: "test.blueprint.only")
        }
        DocumentLayoutBlueprint.setProvider(nil)
        XCTAssertEqual(
            leafContentTypes(in: DocumentLayoutBlueprint.makeTabLayout()),
            [NestedContentRegistry.placeholderIdentifier, NestedContentRegistry.placeholderIdentifier]
        )
    }

    /// The document's writer can run off the main actor, and it seeds new
    /// packages from the blueprint — so reading it from another thread has to
    /// work, not just happen to.
    func testBlueprintIsReadableOffTheMainActor() async {
        DocumentLayoutBlueprint.setProvider {
            LayoutNode.leaf(contentType: "test.blueprint.offmain")
        }
        let types = await Task.detached {
            DocumentLayoutBlueprint.makeTabLayout()
        }.value
        XCTAssertEqual(leafContentTypes(in: types), ["test.blueprint.offmain"])
    }

    // MARK: - Pane metrics

    func testUnregisteredIdentifierGetsDefaultMetrics() {
        let metrics = NestedContentRegistry.metrics(for: "test.metrics.never-registered")
        XCTAssertEqual(metrics.minimumThickness, NestedContentRegistry.PaneMetrics.default.minimumThickness)
        XCTAssertNil(metrics.preferredThicknessFraction)
    }

    func testRegisteredMetricsReachTheSplitViewItem() {
        let identifier = "test.metrics.sidebar"
        NestedContentRegistry.register(
            identifier,
            metrics: .init(minimumThickness: 175, preferredThicknessFraction: 0.2)
        ) { _, _, paneNumber in
            PlaceholderPaneViewController(paneNumber: paneNumber)
        }

        let sidebar = makeLeaf(UUID(), identifier)
        let other = makeLeaf(UUID(), "test.metrics.plain")
        let root = NestingSplitViewController(
            nodeID: UUID(),
            orientation: .horizontal,
            first: sidebar,
            second: other,
            document: document,
            isRoot: true
        )
        _ = root.view

        XCTAssertEqual(root.splitViewItems.first?.minimumThickness, 175)
        XCTAssertEqual(root.splitViewItems.first?.preferredThicknessFraction, 0.2)

        // An identifier with no registration keeps the defaults rather than
        // inheriting its neighbour's.
        XCTAssertEqual(root.splitViewItems.last?.minimumThickness, 120)
    }

    // MARK: - Content lifecycle

    func testContentIsAdoptedAsAChildViewController() {
        let identifier = "test.content.child"
        NestedContentRegistry.register(identifier) { _, _, _ in
            TeardownSpyViewController()
        }
        let leaf = makeLeaf(UUID(), identifier)
        _ = leaf.view

        let content = leaf.contentViewController
        XCTAssertTrue(content is TeardownSpyViewController)
        // Containment is what keeps the content alive and gets it appearance
        // callbacks; a bare view would have neither.
        XCTAssertIdentical(content?.parent, leaf)
        XCTAssertEqual(leaf.children.count, 1)
    }

    func testRemovingAPaneTearsDownItsContent() {
        let identifier = "test.content.teardown"
        NestedContentRegistry.register(identifier) { _, _, _ in
            TeardownSpyViewController()
        }
        let doomed = makeLeaf(UUID(), identifier)
        let survivor = makeLeaf(UUID(), identifier)
        let root = NestingSplitViewController(
            nodeID: UUID(),
            orientation: .horizontal,
            first: doomed,
            second: survivor,
            document: document,
            isRoot: true
        )
        _ = root.view

        let spy = doomed.contentViewController as? TeardownSpyViewController
        XCTAssertEqual(spy?.teardownCount, 0)
        root.remove(doomed)
        XCTAssertEqual(spy?.teardownCount, 1)

        // The surviving pane keeps its content running.
        let survivorSpy = survivor.contentViewController as? TeardownSpyViewController
        XCTAssertEqual(survivorSpy?.teardownCount, 0)
    }

    func testTheLastPaneIsNotTornDownBecauseItIsNotRemoved() {
        let identifier = "test.content.lastpane"
        NestedContentRegistry.register(identifier) { _, _, _ in
            TeardownSpyViewController()
        }
        let only = makeLeaf(UUID(), identifier)
        let root = NestingSplitViewController(
            nodeID: UUID(),
            orientation: .horizontal,
            children: [only],
            document: document,
            isRoot: true
        )
        _ = root.view

        root.remove(only)
        let spy = only.contentViewController as? TeardownSpyViewController
        XCTAssertEqual(spy?.teardownCount, 0)
    }

    // MARK: - Helpers

    private func makeLeaf(_ id: UUID, _ contentType: String) -> NestedViewController {
        NestedViewController(
            nodeID: id,
            paneNumber: document.allocatePaneNumber(),
            contentTypeIdentifier: contentType,
            document: document
        )
    }
}

/// Stands in for pane content that owns something worth releasing — a shell, an
/// FSEvents stream — and counts how many times the pane told it to let go.
@MainActor
private final class TeardownSpyViewController: NSViewController, PaneContentTeardown {

    private(set) var teardownCount = 0

    override func loadView() {
        view = NSView(frame: NSRect(x: 0, y: 0, width: 100, height: 100))
    }

    func paneContentWillBeDiscarded() {
        teardownCount += 1
    }
}
