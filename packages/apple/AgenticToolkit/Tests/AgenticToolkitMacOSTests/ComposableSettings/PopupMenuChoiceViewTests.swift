import Foundation
import Testing
import AppKit
import AgenticToolkitCore
@testable import AgenticToolkitMacOS

/// `PopupMenuChoiceView` writes a user selection straight to the setting. The
/// gesture-scoped `confirmChange` veto hook was removed as dead code (no assigner
/// in any repo; the large-model confirmation lives in
/// `ModelChooserViewController.confirmLargeModel`).
@Suite("PopupMenuChoiceView")
@MainActor
struct PopupMenuChoiceViewTests {

    @Test("a user selection writes the setting directly")
    func selectionWritesSetting() {
        let setting = UserSetting<String>("test.popupChoice.\(UUID().uuidString)", default: "a")
        let viewModel = ComposableSettings.ChoiceViewModel(
            title: "T", setting: setting,
            choices: [
                .init(label: "A", value: "a"),
                .init(label: "B", value: "b")
            ])
        let view = ComposableSettings.PopupMenuChoiceView(viewModel: viewModel)
        view.popUpButton.selectItem(at: 1)
        _ = view.popUpButton.target?.perform(view.popUpButton.action, with: view.popUpButton)
        #expect(viewModel.value == "b")
    }
}
