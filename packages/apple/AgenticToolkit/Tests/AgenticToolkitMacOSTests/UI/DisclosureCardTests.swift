import AppKit
import XCTest
@testable import AgenticToolkitMacOS

/// Pins the rules a stack of folding cards lives by: the arithmetic of the
/// remembered set (`CardFoldMemory`); the one that a fold is a change of HEIGHT
/// — a card is exactly as wide shut as it is open, so a window that hugs its
/// content cannot jump sideways when the reader clicks a disclosure triangle;
/// and where a card's standing goes now that it is a corner badge rather than a
/// reserved slot on the masthead.
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
                symbolName: "octagon.fill", colorName: "red", accessibilityLabel: "Spent"
            ),
            isCollapsed: isCollapsed,
            scaledSize: 13
        )
        let wide = NSView(frame: NSRect(x: 0, y: 0, width: 600, height: 60))
        wide.widthAnchor.constraint(equalToConstant: 600).isActive = true
        card.addContent(wide)
        // Hosted rather than merely measured: a card that was never given a
        // size lays its subviews out against a frame nothing set, so anything
        // about WHERE a subview lands has to be read off a laid-out card.
        host(card, width: 700)
        return card
    }

    /// Puts a card in a view of a known width and lays it out, returning the
    /// host so a test can compare the two.
    @discardableResult
    private func host(_ card: DisclosureCardView, width: CGFloat) -> NSView {
        card.translatesAutoresizingMaskIntoConstraints = false
        let host = NSView(frame: NSRect(x: 0, y: 0, width: width, height: 400))
        host.addSubview(card)
        NSLayoutConstraint.activate([
            card.leadingAnchor.constraint(equalTo: host.leadingAnchor),
            card.trailingAnchor.constraint(equalTo: host.trailingAnchor),
            card.topAnchor.constraint(equalTo: host.topAnchor)
        ])
        host.layoutSubtreeIfNeeded()
        return host
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

    func testAFoldedCardIsAsWideAsAnOpenOneEvenWhenItsSummaryIsWiderThanItsContent() {
        // The other half of the same rule, and the one the masthead floor is
        // for: with the summary's well out of the OPEN card's layout, the width
        // it will want on folding has to be reserved somewhere that does not
        // depend on which state the card is in.
        func narrow(isCollapsed: Bool) -> DisclosureCardView {
            let card = DisclosureCardView(
                title: "me@x.com",
                titleIsAccent: true,
                summary: [
                    .init(name: "5H", value: "23%", colorName: "blue"),
                    .init(name: "7D", value: "12%", colorName: "green")
                ],
                isCollapsed: isCollapsed,
                scaledSize: 13
            )
            let tiny = NSView()
            tiny.translatesAutoresizingMaskIntoConstraints = false
            tiny.widthAnchor.constraint(equalToConstant: 40).isActive = true
            tiny.heightAnchor.constraint(equalToConstant: 20).isActive = true
            card.addContent(tiny)
            card.layoutSubtreeIfNeeded()
            return card
        }
        XCTAssertEqual(narrow(isCollapsed: true).fittingSize.width,
                       narrow(isCollapsed: false).fittingSize.width,
                       accuracy: 0.5)
    }

    // MARK: - The standing is a corner badge

    /// The badge and the toggle, found by kind rather than by outlet — the card
    /// keeps both private, and what these tests are about is where they land.
    private func badge(of card: DisclosureCardView) -> NSImageView? {
        card.subviews.compactMap { $0 as? NSImageView }.first
    }

    private func toggle(of card: DisclosureCardView) -> NSButton? {
        func find(_ view: NSView) -> NSButton? {
            if let button = view as? NSButton { return button }
            for child in view.subviews {
                if let found = find(child) { return found }
            }
            return nil
        }
        return find(card)
    }

    private func field(_ text: String, in card: DisclosureCardView) -> NSTextField? {
        func find(_ view: NSView) -> NSTextField? {
            if let label = view as? NSTextField, label.stringValue == text { return label }
            for child in view.subviews {
                if let found = find(child) { return found }
            }
            return nil
        }
        return find(card)
    }

    func testTheStandingSitsOnTheCardsTopRightCornerAndNeverOverTheToggle() {
        let card = card(isCollapsed: false)
        guard let badge = badge(of: card), let toggle = toggle(of: card) else {
            return XCTFail("a card with a standing draws a badge, and every card has a toggle")
        }
        XCTAssertFalse(badge.isHidden)
        // Top-right corner: hard against both edges, bar the hairline inset.
        // Measured on the ALIGNMENT rect, which is what the constraints place:
        // an SF Symbol carries alignment insets, so its frame spills a point or
        // two past the box the layout engine positioned.
        let inset = DisclosureCardView.cornerBadgeInset(scaledSize: 13)
        let box = badge.alignmentRect(forFrame: badge.frame)
        XCTAssertEqual(box.maxX, card.bounds.maxX - inset, accuracy: 0.5)
        XCTAssertEqual(box.maxY, card.bounds.maxY - inset, accuracy: 0.5)
        // …and clear of the triangle, which is the whole constraint on where the
        // corner may be: the badge lives in the gutter to the RIGHT of it.
        let triangle = toggle.convert(toggle.bounds, to: card)
        XCTAssertFalse(badge.frame.intersects(triangle),
                       "the badge must not cover the disclosure toggle")
        XCTAssertGreaterThanOrEqual(badge.frame.minX, triangle.maxX)
    }

    func testACardWithNothingToReportDrawsNothing() {
        // No reserved slot any more: a card with no standing pays nothing for
        // the cards that have one.
        let card = DisclosureCardView(title: "Quiet", titleIsAccent: false, scaledSize: 13)
        card.layoutSubtreeIfNeeded()
        XCTAssertEqual(badge(of: card)?.isHidden, true)
    }

    func testTheStandingIsSpokenSinceItShareItsLineWithNothing() {
        let card = card(isCollapsed: true)
        XCTAssertEqual(badge(of: card)?.accessibilityLabel(), "Spent")
        XCTAssertEqual(badge(of: card)?.toolTip, "Spent")
    }

    // MARK: - The title gets the room the summary is not using

    func testWhenTheWindowCannotGrowItIsTheTitleThatYields() {
        // The card asks for room for both, but a window can refuse. Held to a
        // width neither fits in, it is the address that goes short: a truncated
        // address is still recognisable, and a truncated percentage is a lie.
        let title = "a-very-long-address@some-organisation.example.com"
        let card = DisclosureCardView(
            title: title,
            titleIsAccent: true,
            summary: [
                .init(name: "5H", value: "23%", colorName: "blue"),
                .init(name: "7D", value: "12%", colorName: "green")
            ],
            isCollapsed: true,
            scaledSize: 13
        )
        card.translatesAutoresizingMaskIntoConstraints = false
        let host = NSView(frame: NSRect(x: 0, y: 0, width: 300, height: 80))
        host.addSubview(card)
        NSLayoutConstraint.activate([
            card.leadingAnchor.constraint(equalTo: host.leadingAnchor),
            card.topAnchor.constraint(equalTo: host.topAnchor),
            // Required, so it beats the card's own width floor the way a window
            // the reader has dragged narrow does.
            card.widthAnchor.constraint(equalToConstant: 300)
        ])
        host.layoutSubtreeIfNeeded()

        guard let label = field(title, in: card) else { return XCTFail("no title") }
        XCTAssertLessThan(label.frame.width, label.fittingSize.width,
                          "there was no room for the whole address, so it must have gone short")
        XCTAssertGreaterThan(label.frame.width, 0)
    }

    func testACardAsksForTheRoomToWriteItsTitleWholeBesideItsSummary() {
        // The other half: a folded card DOES carry both on one line, so the
        // width it asks for has to fit both. Truncation is what a title does
        // when the window can be no wider — not what it does while the card is
        // free to ask for another forty points.
        let title = "a-very-long-address@some-organisation.example.com"
        let card = DisclosureCardView(
            title: title,
            titleIsAccent: true,
            summary: [
                .init(name: "5H", value: "23%", colorName: "blue"),
                .init(name: "7D", value: "12%", colorName: "green")
            ],
            isCollapsed: true,
            scaledSize: 13
        )
        let tiny = NSView()
        tiny.translatesAutoresizingMaskIntoConstraints = false
        tiny.widthAnchor.constraint(equalToConstant: 40).isActive = true
        tiny.heightAnchor.constraint(equalToConstant: 20).isActive = true
        card.addContent(tiny)

        // At exactly the width the card asks for — a window that hugs its
        // content gives it that and no more.
        host(card, width: card.fittingSize.width)
        guard let label = field(title, in: card) else { return XCTFail("no title") }
        XCTAssertGreaterThanOrEqual(label.frame.width, label.fittingSize.width - 0.5,
                                    "the address was squeezed by a card that could have grown")
    }
}
