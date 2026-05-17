import AppKit

@MainActor
private var coordinator: NotesCoordinator? {
    NSApp.scriptingHost?.feature(NotesCoordinator.self)
}

@objc(ShowNotesCommand)
public final class ShowNotesCommand: MainActorScriptCommand, @unchecked Sendable {
    public override func performMain() -> Any? {
        coordinator?.showNotesWindow()
        return nil
    }
}

@objc(HideNotesCommand)
public final class HideNotesCommand: MainActorScriptCommand, @unchecked Sendable {
    public override func performMain() -> Any? {
        coordinator?.notesWindowController.dismiss()
        return nil
    }
}

@objc(ShowQuickNoteCommand)
public final class ShowQuickNoteCommand: MainActorScriptCommand, @unchecked Sendable {
    public override func performMain() -> Any? {
        coordinator?.showQuickNoteWindow()
        return nil
    }
}
