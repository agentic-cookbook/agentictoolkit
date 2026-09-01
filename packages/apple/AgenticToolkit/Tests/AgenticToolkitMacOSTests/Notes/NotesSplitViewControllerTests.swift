import AppKit
import XCTest
@testable import AgenticToolkitMacOS

/// The notes pane has to reopen at the width it was left at. AppKit restores an
/// autosaved divider position when the name is assigned, which makes two things
/// load-bearing and neither of them visible at the call site: the name must be
/// set *after* the split items exist, and the list must hold its width while the
/// pane lays out. These pin both.
@MainActor
final class NotesSplitViewControllerTests: XCTestCase {

    /// Notes are irrelevant to divider geometry, so storage is an empty stub
    /// rather than a database.
    private struct EmptyNoteStorage: NoteStorage {
        func fetchAllNotes() throws -> [Note] { [] }
        func insertNote(_ note: Note) throws {}
        func updateNote(_ note: Note) throws {}
        func deleteNote(id: UUID) throws {}
    }

    /// Divider positions live in `UserDefaults` under a global key, so each test
    /// gets a name of its own and takes it away again.
    private func makeAutosaveName() -> String {
        let name = "notes-split-tests-\(UUID().uuidString)"
        addTeardownBlock {
            UserDefaults.standard.removeObject(forKey: "NSSplitView Subview Frames \(name)")
        }
        return name
    }

    private func makeSplit(autosaveName: String) -> NotesSplitViewController {
        NotesSplitViewController(
            notesManager: NotesManager(storage: EmptyNoteStorage()),
            autosaveName: autosaveName
        )
    }

    private func seedDividerPosition(_ listWidth: CGFloat, totalWidth: CGFloat, name: String) {
        let editorWidth = totalWidth - listWidth - 1
        UserDefaults.standard.set(
            [
                "0.000000, 0.000000, \(listWidth).000000, 532.000000, NO, NO",
                "\(listWidth + 1).000000, 0.000000, \(editorWidth).000000, 532.000000, NO, NO"
            ],
            forKey: "NSSplitView Subview Frames \(name)"
        )
    }

    func testLoadingInstallsTheListBesideTheEditor() {
        let split = makeSplit(autosaveName: makeAutosaveName())
        split.loadViewIfNeeded()

        XCTAssertEqual(split.splitViewItems.count, 2)
        XCTAssertTrue(split.splitView.isVertical, "the list sits beside the note, not above it")
    }

    /// AppKit keys divider positions globally, so two notes panes alive at once
    /// under one name overwrite each other's.
    func testTheAutosaveNameIsTheCallersToChoose() {
        let first = makeSplit(autosaveName: "notes-a")
        let second = makeSplit(autosaveName: "notes-b")
        first.loadViewIfNeeded()
        second.loadViewIfNeeded()

        XCTAssertEqual(first.splitView.autosaveName, "notes-a")
        XCTAssertNotEqual(first.splitView.autosaveName, second.splitView.autosaveName)
    }

    /// The list keeps the width it was given and the editor takes the slack.
    /// With equal priorities both panes share every resize, and a restored width
    /// is scaled away as the pane grows into place.
    func testTheListHoldsItsWidthAgainstTheEditor() {
        let split = makeSplit(autosaveName: makeAutosaveName())
        split.loadViewIfNeeded()

        XCTAssertGreaterThan(
            split.splitViewItems[0].holdingPriority.rawValue,
            split.splitViewItems[1].holdingPriority.rawValue
        )
    }

    /// The regression: a name assigned to a split view with no items yet
    /// restores nothing, and AppKit never tries again — the pane reopened at
    /// whatever the constraints produced, not at the width it was left at.
    func testASavedDividerPositionIsRestoredWhenThePaneOpens() {
        let name = makeAutosaveName()
        seedDividerPosition(220, totalWidth: 969, name: name)

        let split = makeSplit(autosaveName: name)
        split.loadViewIfNeeded()

        XCTAssertEqual(split.splitView.subviews[0].frame.width, 220, accuracy: 1)
    }

    /// Nothing saved is the one case where a hard-coded width is right; applying
    /// it unconditionally is what used to overwrite the restored position.
    func testAPaneNobodyHasSizedOpensAtTheDefaultWidth() {
        let split = makeSplit(autosaveName: makeAutosaveName())
        split.loadViewIfNeeded()

        XCTAssertEqual(split.splitView.subviews[0].frame.width, 240, accuracy: 1)
    }
}
