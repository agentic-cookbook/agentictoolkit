import XCTest
import AgenticToolkitMacOS

/// The slot invariant: a `thicknessFraction` describes a *place* in a split,
/// not the subtree that happens to be filling it. Every rewrite that moves a
/// subtree into another one's place therefore has to carry the place's size
/// across — or a move, a close, or the reconcile that runs on every restore
/// silently resets the arrangement the user dragged into being.
@MainActor
final class LayoutNodeThicknessTests: XCTestCase {

    private let editor = ComposableTabsViewID("test.thickness.editor")
    private let terminal = ComposableTabsViewID("test.thickness.terminal")

    // MARK: - Moves

    /// A move rewrites one corner of the tree. Every slot it did not disturb
    /// keeps the size the user dragged it to — otherwise closing one pane
    /// rearranges the whole window.
    func testAMoveKeepsTheSlotsItDidNotDisturb() throws {
        let sidebar = LayoutNode.leaf(contentType: editor, thicknessFraction: 0.25)
        let top = LayoutNode.leaf(contentType: terminal, thicknessFraction: 0.5)
        let bottom = LayoutNode.leaf(contentType: terminal, thicknessFraction: 0.5)
        let root = LayoutNode.split(
            orientation: .horizontal,
            first: sidebar,
            second: .split(
                orientation: .vertical, first: top, second: bottom, thicknessFraction: 0.75)
        )

        let moved = try XCTUnwrap(ComposableTabsMove.moving(bottom.id, .left, in: root))
        guard case .split(_, let newFirst, let newSecond) = moved.kind else {
            return XCTFail("the root is still a split")
        }
        XCTAssertEqual(try XCTUnwrap(newFirst.thicknessFraction), 0.25, accuracy: 0.0001,
                       "the pane landed in the sidebar's slot, so it is that slot's width it fills")
        XCTAssertEqual(try XCTUnwrap(newSecond.thicknessFraction), 0.75, accuracy: 0.0001,
                       "the survivor of the stack takes over the stack's slot")
    }

    /// The size a pane carried is its share of the split it just left. Carrying
    /// it into a split that did not exist a moment ago would put two unrelated
    /// numbers on one divider — a 0.5 of a vertical stack next to a 0.25 of the
    /// window — which add up to nothing in particular.
    func testANewlyPairedPaneBringsNoSizeWithIt() throws {
        let sidebar = LayoutNode.leaf(contentType: editor, thicknessFraction: 0.25)
        let stacked = LayoutNode.leaf(contentType: terminal, thicknessFraction: 0.5)
        let root = LayoutNode.split(
            orientation: .horizontal,
            first: sidebar,
            second: .split(
                orientation: .vertical,
                first: .leaf(contentType: terminal, thicknessFraction: 0.5),
                second: stacked,
                thicknessFraction: 0.75
            )
        )

        let moved = try XCTUnwrap(ComposableTabsMove.moving(stacked.id, .left, in: root))
        guard case .split(_, let newFirst, _) = moved.kind,
              case .split(_, let paired, let displaced) = newFirst.kind else {
            return XCTFail("the arriving pane paired up with the sidebar")
        }
        XCTAssertNil(paired.thicknessFraction, "the pane's old share does not follow it")
        XCTAssertNil(displaced.thicknessFraction,
                     "nor does the sidebar's, which was a share of the window, not of this pair")
    }

    /// A split left with one child collapses into it, and the survivor is now
    /// filling the slot the split filled.
    func testASurvivorInheritsTheSlotOfTheSplitItReplaces() throws {
        let doomed = LayoutNode.leaf(contentType: editor, thicknessFraction: 0.4)
        let survivor = LayoutNode.leaf(contentType: terminal, thicknessFraction: 0.6)
        let inner = LayoutNode.split(
            orientation: .vertical, first: doomed, second: survivor, thicknessFraction: 0.3)
        let root = LayoutNode.split(
            orientation: .horizontal,
            first: inner,
            second: .leaf(contentType: editor, thicknessFraction: 0.7)
        )

        let removed = try XCTUnwrap(ComposableTabsMove.removing(doomed.id, from: root))
        guard case .split(_, let promoted, let other) = removed.kind else {
            return XCTFail("the root is still a split")
        }
        XCTAssertEqual(try XCTUnwrap(promoted.thicknessFraction), 0.3, accuracy: 0.0001,
                       "the survivor takes over the inner split's slot, not its own old share of it")
        XCTAssertEqual(try XCTUnwrap(other.thicknessFraction), 0.7, accuracy: 0.0001,
                       "the pane on the other side of the window did not move and does not resize")
    }

    // MARK: - Reconciliation

    /// `reconcile` runs on every restore, so a rewrite there that dropped the
    /// sizes would mean no arrangement ever survived a relaunch — the original
    /// bug, one layer down from where it showed.
    func testReconciliationKeepsEveryStoredSize() throws {
        let spec = ComposableTabLayoutSpec.split(
            axis: .horizontal,
            children: [.pane(editor), .pane(editor)],
            allows: [.init(editor, min: 0, max: 2)]
        )
        let stored = LayoutNode.split(
            orientation: .horizontal,
            first: .leaf(contentType: editor, thicknessFraction: 0.35),
            second: .leaf(contentType: editor, thicknessFraction: 0.65),
            thicknessFraction: 0.5
        )

        let repaired = spec.reconcile(stored)
        guard case .split(_, let first, let second) = repaired.kind else {
            return XCTFail("reconciliation keeps the shape")
        }
        XCTAssertEqual(try XCTUnwrap(repaired.thicknessFraction), 0.5, accuracy: 0.0001)
        XCTAssertEqual(try XCTUnwrap(first.thicknessFraction), 0.35, accuracy: 0.0001)
        XCTAssertEqual(try XCTUnwrap(second.thicknessFraction), 0.65, accuracy: 0.0001)
    }
}
