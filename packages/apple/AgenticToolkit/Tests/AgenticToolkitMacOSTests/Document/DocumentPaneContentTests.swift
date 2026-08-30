import XCTest
import AppKit
import AgenticToolkitMacOS

/// What an app gets to say about a document's panes: which views exist, how
/// wide each one wants to be, and what a fresh tab starts out holding.
///
/// A registry is per-layout rather than process-global now, so each test builds
/// its own and hands it to the document. Only `ComposableTabsLayout.install` is
/// still global, so only that is undone in `tearDown`.
@MainActor
final class DocumentPaneContentTests: XCTestCase {

    private let sidebar = ComposableTabsViewID("test.sidebar")
    private let notes = ComposableTabsViewID("test.notes")
    private let terminal = ComposableTabsViewID("test.terminal")

    private lazy var document = ComposableTabsDocument()

    nonisolated override func tearDown() {
        // `install` is nonisolated, which is the whole point of it: the
        // document's writer reads the installed layout off the main actor.
        ComposableTabsLayout.install(nil)
        super.tearDown()
    }

    private func leafViewIDs(in node: LayoutNode) -> [ComposableTabsViewID] {
        switch node.kind {
        case .leaf(let viewID, _):
            return [viewID]
        case .split(_, let first, let second):
            return leafViewIDs(in: first) + leafViewIDs(in: second)
        }
    }

    private func axis(of node: LayoutNode) -> ComposableTabsAxis? {
        if case .split(let axis, _, _) = node.kind { return axis }
        return nil
    }

    // MARK: - Blueprint

    func testDefaultBlueprintIsTwoPlaceholdersSideBySide() {
        let layout = ComposableTabsLayout.makeTabLayout()
        XCTAssertEqual(axis(of: layout), .horizontal)
        XCTAssertEqual(leafViewIDs(in: layout), [.placeholder, .placeholder])
    }

    func testInstalledLayoutReplacesTheDefaultBlueprint() throws {
        ComposableTabsLayout.install(try makeLayout(spec: .split(
            axis: .vertical,
            children: [.pane(notes), .pane(terminal)],
            allows: [.init(notes), .unbounded(terminal)]
        )))
        let layout = ComposableTabsLayout.makeTabLayout()
        XCTAssertEqual(axis(of: layout), .vertical)
        XCTAssertEqual(leafViewIDs(in: layout), [notes, terminal])
    }

    func testClearingTheInstalledLayoutRestoresTheDefaultBlueprint() throws {
        ComposableTabsLayout.install(try makeLayout(spec: .pane(notes, allows: [.init(notes)])))
        ComposableTabsLayout.install(nil)
        XCTAssertEqual(
            leafViewIDs(in: ComposableTabsLayout.makeTabLayout()),
            [.placeholder, .placeholder]
        )
    }

    /// The document's writer can run off the main actor, and it seeds new
    /// packages from the blueprint — so reading it from another thread has to
    /// work, not just happen to.
    func testBlueprintIsReadableOffTheMainActor() async throws {
        ComposableTabsLayout.install(try makeLayout(spec: .pane(notes, allows: [.init(notes)])))
        let tree = await Task.detached {
            ComposableTabsLayout.makeTabLayout()
        }.value
        XCTAssertEqual(leafViewIDs(in: tree), [notes])
    }

    // MARK: - Pane descriptors

    func testUnregisteredViewGetsTheUnknownDescriptor() {
        let registry = ComposableTabsViewRegistry()
        let descriptor = registry.descriptor(for: "test.never-registered")
        XCTAssertEqual(
            descriptor.minimumThickness,
            ComposableTabsViewDescriptor.unknown.minimumThickness
        )
        XCTAssertNil(descriptor.preferredThicknessFraction)
    }

    func testRegisteredDescriptorReachesTheSplitViewItem() throws {
        try installTestLayout()

        let root = ComposableTabsViewController(
            nodeID: UUID(),
            axis: .horizontal,
            first: makeLeaf(sidebar),
            second: makeLeaf(.placeholder),
            document: document,
            isRoot: true
        )
        _ = root.view

        XCTAssertEqual(root.splitViewItems.first?.minimumThickness, 175)
        XCTAssertEqual(root.splitViewItems.first?.preferredThicknessFraction, 0.2)

        // The placeholder keeps the default thickness rather than inheriting
        // its neighbour's.
        XCTAssertEqual(root.splitViewItems.last?.minimumThickness, 120)
    }

    /// A nested split is not "some view controller with default metrics" — it is
    /// as wide as what it holds. Stacked children are as wide as the widest one.
    func testANestedSplitReportsTheWidestOfItsStackedChildren() throws {
        try installTestLayout()

        let inner = ComposableTabsViewController(
            nodeID: UUID(),
            axis: .vertical,
            first: makeLeaf(notes),        // 320
            second: makeLeaf(terminal),    // 400
            document: document,
            isRoot: false
        )
        let root = ComposableTabsViewController(
            nodeID: UUID(),
            axis: .horizontal,
            first: makeLeaf(sidebar),
            second: inner,
            document: document,
            isRoot: true
        )
        _ = root.view

        XCTAssertEqual(root.splitViewItems.last?.minimumThickness, 400)
    }

    /// Children arranged along the same axis as the parent stack up, so the
    /// split needs room for all of them at once.
    func testANestedSplitSumsChildrenLaidOutAlongTheSameAxis() throws {
        try installTestLayout()

        let inner = ComposableTabsViewController(
            nodeID: UUID(),
            axis: .horizontal,
            first: makeLeaf(notes),        // 320
            second: makeLeaf(terminal),    // 400
            document: document,
            isRoot: false
        )
        let root = ComposableTabsViewController(
            nodeID: UUID(),
            axis: .horizontal,
            first: makeLeaf(.placeholder),
            second: inner,
            document: document,
            isRoot: true
        )
        _ = root.view

        XCTAssertEqual(root.splitViewItems.last?.minimumThickness, 720)
    }

    /// A pane that named a fraction holds the width it was given when the window
    /// grows; without a higher holding priority AppKit spreads the growth evenly
    /// and a 22% sidebar ends up owning half the window.
    func testAPaneWithAPreferredFractionResistsResizeMoreThanItsNeighbours() throws {
        try installTestLayout()

        let root = ComposableTabsViewController(
            nodeID: UUID(),
            axis: .horizontal,
            first: makeLeaf(sidebar),
            second: makeLeaf(notes),
            document: document,
            isRoot: true
        )
        _ = root.view

        let sidebarPriority = root.splitViewItems.first?.holdingPriority.rawValue ?? 0
        let contentPriority = root.splitViewItems.last?.holdingPriority.rawValue ?? 0
        XCTAssertGreaterThan(sidebarPriority, contentPriority)
    }

    // MARK: - Content lifecycle

    func testContentIsAdoptedAsAChildViewController() throws {
        try installTeardownSpyLayout()
        let leaf = makeLeaf(notes)
        _ = leaf.view

        let content = leaf.contentViewController
        XCTAssertTrue(content is TeardownSpyViewController)
        // Containment is what keeps the content alive and gets it appearance
        // callbacks; a bare view would have neither.
        XCTAssertIdentical(content?.parent, leaf)
        XCTAssertEqual(leaf.children.count, 1)
    }

    func testRemovingAPaneTearsDownItsContent() throws {
        try installTeardownSpyLayout()
        let doomed = makeLeaf(terminal)
        let survivor = makeLeaf(terminal)
        let root = ComposableTabsViewController(
            nodeID: UUID(),
            axis: .horizontal,
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

    func testTheLastPaneIsNotTornDownBecauseItIsNotRemoved() throws {
        try installTeardownSpyLayout()
        let only = makeLeaf(terminal)
        let root = ComposableTabsViewController(
            nodeID: UUID(),
            axis: .horizontal,
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

    /// A sidebar that names a fraction, plus two views with distinct minimums —
    /// the three shapes the metrics tests need.
    private func makeTestRegistry(
        content: ComposableTabsViewRegistry.Factory? = nil
    ) -> ComposableTabsViewRegistry {
        let factory: ComposableTabsViewRegistry.Factory = content ?? { context in
            PlaceholderPaneViewController(paneNumber: context.paneNumber)
        }
        let registry = ComposableTabsViewRegistry()
        registry.register(sidebar, descriptor: .init(
            displayName: "Sidebar",
            preferredAxis: .horizontal,
            minimumThickness: 175,
            preferredThicknessFraction: 0.2
        ), factory: factory)
        registry.register(notes, descriptor: .init(
            displayName: "Notes", preferredAxis: .vertical, minimumThickness: 320
        ), factory: factory)
        registry.register(terminal, descriptor: .init(
            displayName: "Terminal", preferredAxis: .vertical, minimumThickness: 400
        ), factory: factory)
        return registry
    }

    private func makeLayout(
        spec: ComposableTabLayoutSpec,
        registry: ComposableTabsViewRegistry? = nil
    ) throws -> ComposableTabsLayout {
        try ComposableTabsLayout(registry: registry ?? makeTestRegistry(), spec: spec)
    }

    private var testSpec: ComposableTabLayoutSpec {
        .split(
            axis: .horizontal,
            children: [
                .pane(sidebar),
                .split(axis: .vertical, children: [.pane(notes), .pane(terminal)])
            ],
            allows: [
                .init(sidebar), .init(notes), .unbounded(terminal), .unbounded(.placeholder)
            ]
        )
    }

    private func installTestLayout() throws {
        document.layout = try makeLayout(spec: testSpec)
    }

    private func installTeardownSpyLayout() throws {
        document.layout = try makeLayout(
            spec: testSpec,
            registry: makeTestRegistry { _ in TeardownSpyViewController() }
        )
    }

    private func makeLeaf(_ viewID: ComposableTabsViewID) -> ComposableTabsPaneViewController {
        ComposableTabsPaneViewController(
            nodeID: UUID(),
            paneNumber: document.allocatePaneNumber(),
            viewID: viewID,
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
