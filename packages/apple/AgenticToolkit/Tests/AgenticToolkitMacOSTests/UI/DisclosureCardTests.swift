import AppKit
import XCTest
import AgenticToolkitMacOS

/// Pins the two rules a stack of folding cards lives by: the arithmetic of the
/// remembered set (`CardFoldMemory`), and the one that a fold is a change of
/// HEIGHT — a card is exactly as wide shut as it is open, so a window that hugs
/// its content cannot jump sideways when the reader clicks a disclosure
/// triangle.
@MainActor
final class DisclosureCardTests: XCTestCase {

    // MARK: - The remembered set

    func testFoldingACardRecordsItAndUnfoldingForgetsIt() {
        var keys = CardFoldMemory.toggling([], key: "usage", collapsed: true)
        XCTAssertEqual(keys, ["usage"])

        keys = CardFoldMemory.toggling(keys, key: "usage", collapsed: false)
        XCTAssertEqual(keys, [], "open is ABSENT, not stored as false")
    }

    func testFoldingTwiceDoesNotStoreTheCardTwice() {
        let once = CardFoldMemory.toggling(["a"], key: "usage", collapsed: true)
        let twice = CardFoldMemory.toggling(once, key: "usage", collapsed: true)
        XCTAssertEqual(twice, ["a", "usage"])
    }

    func testUnfoldingOneCardLeavesTheOthersFolded() {
        XCTAssertEqual(
            CardFoldMemory.toggling(["a", "usage", "b"], key: "usage", collapsed: false),
            ["a", "b"]
        )
    }

    func testAMemoryReadsAndWritesTheHostsStore() {
        var stored: [String] = []
        var rebuilds = 0
        let memory = CardFoldMemory(
            read: { stored },
            write: { stored = $0 },
            rebuild: { rebuilds += 1 }
        )
        XCTAssertFalse(memory.isCollapsed("a"))

        memory.setCollapsed(true, key: "a")
        XCTAssertEqual(stored, ["a"])
        XCTAssertTrue(memory.isCollapsed("a"))
        // The rebuild is deferred to the next turn of the runloop on purpose:
        // it tears down the very button that is still dispatching the click.
        XCTAssertEqual(rebuilds, 0, "a rebuild must not run inside the toggle's own action")
    }

    func testACardBuiltThroughTheMemoryOpensInTheRememberedState() {
        let memory = CardFoldMemory(read: { ["shut"] }, write: { _ in }, rebuild: {})

        XCTAssertTrue(memory.card(key: "shut", title: "Shut", scaledSize: 13).isCollapsed)
        XCTAssertFalse(memory.card(key: "open", title: "Open", scaledSize: 13).isCollapsed)
    }

    // MARK: - Folding is a change of height, never of width

    private func card(isCollapsed: Bool) -> DisclosureCardView {
        let card = DisclosureCardView(
            title: "mike@example.com",
            titleIsAccent: true,
            summary: [
                .init(name: "5H", value: "23%", colorName: "blue"),
                .init(name: "7D", value: "12%", colorName: "green")
            ],
            status: .init(
                symbolName: "hand.thumbsup.fill", colorName: "green", accessibilityLabel: "Active"
            ),
            statusVocabulary: ["hand.thumbsup.fill", "octagon.fill"],
            isCollapsed: isCollapsed,
            scaledSize: 13
        )
        let wide = NSView(frame: NSRect(x: 0, y: 0, width: 600, height: 60))
        wide.widthAnchor.constraint(equalToConstant: 600).isActive = true
        card.addContent(wide)
        card.layoutSubtreeIfNeeded()
        return card
    }

    func testAFoldedCardIsExactlyAsWideAsAnOpenOne() {
        // The bug this pins: a folded card that dropped its content asked for a
        // narrower window, so every disclosure click moved the window sideways.
        XCTAssertEqual(card(isCollapsed: true).fittingSize.width,
                       card(isCollapsed: false).fittingSize.width,
                       accuracy: 0.5)
    }

    func testAFoldedCardIsShorterThanAnOpenOne() {
        // …and the fold still does the one thing it is for.
        XCTAssertLessThan(card(isCollapsed: true).fittingSize.height,
                          card(isCollapsed: false).fittingSize.height)
    }

    func testACardIsNeverNarrowerThanTheContentItIsHiding() {
        let card = card(isCollapsed: true)
        XCTAssertGreaterThanOrEqual(card.fittingSize.width, 600,
                                    "the hidden content still sets the card's width floor")
    }

    // MARK: - The reserved status slot

    func testTheStatusSlotIsAsWideAsTheWidestSymbolTheHostNames() {
        let one = DisclosureCardView.statusSlotWidth(
            symbolNames: ["hand.thumbsup.fill"], scaledSize: 13
        )
        let both = DisclosureCardView.statusSlotWidth(
            symbolNames: ["hand.thumbsup.fill", "rectangle.portrait.and.arrow.right"],
            scaledSize: 13
        )
        XCTAssertGreaterThan(one, 0)
        XCTAssertGreaterThanOrEqual(both, one)
    }

    func testAStackWithNoStandingsReservesNothing() {
        XCTAssertEqual(DisclosureCardView.statusSlotWidth(symbolNames: [], scaledSize: 13), 0)
    }
}
