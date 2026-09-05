import AppKit
import Foundation
import SwiftUI
import Testing

import AgenticToolkitCore
@testable import AgenticToolkitMacOS

/// The SwiftUI half of the panel vocabulary, hosted the way a panel hosts it.
///
/// The invariant these guard is the one that broke the settings window twice:
/// **panel content never sizes the window.** `NSHostingView` defaults to
/// `.standardBounds`, which installs *required* min/max constraints from the
/// SwiftUI content — and since the detail pane pins a panel to its edges, those
/// become the window's, collapsing it to a stack of cards' ideal height. So a
/// hosted panel must carry an intrinsic size (which is only a preference) and
/// no size constraints of its own.
@Suite("SettingsCardViews")
@MainActor
struct SettingsCardViewsTests {

    private struct SampleContent: View {

        @State var search = ""

        var body: some View {
            VStack(alignment: .leading, spacing: 20) {
                ComposableSettings.SettingsGroup("Skipped Folders") {
                    ComposableSettings.SettingsCardRow { Text("Library") }
                    ComposableSettings.SettingsCardDivider()
                    ComposableSettings.SettingsCardRow { Text("Applications") }
                }
                ComposableSettings.SettingsGroup {
                    ComposableSettings.SettingsCardRow {
                        ComposableSettings.SettingsSearchField("Search file types", text: $search)
                    }
                }
            }
            .settingsPanelInset()
        }
    }

    /// Lays the hosted content out at a realistic pane size, as the split does.
    private func hosted() -> NSView {
        let view = ComposableSettings.SettingsPanelViewController.hostingView(for: SampleContent())
        view.frame = NSRect(x: 0, y: 0, width: 480, height: 400)
        view.layoutSubtreeIfNeeded()
        return view
    }

    @Test("the vocabulary builds, and reports a real intrinsic height")
    func contentBuilds() {
        let view = hosted()
        let size = view.intrinsicContentSize
        #expect(size.height > 0, "cards that measure nothing are cards that drew nothing")
        #expect(size.height < 400, "the sample is shorter than the pane it was given")
    }

    @Test("a hosted panel carries no size constraints of its own")
    func hostingCarriesNoSizeConstraints() {
        let view = hosted()
        let sizing = view.constraints.filter {
            $0.firstAttribute == .width || $0.firstAttribute == .height
        }
        #expect(sizing.isEmpty, "a required width/height here is the window's, not the panel's")
        #expect((view as? NSHostingView<SampleContent>)?.sizingOptions == [.intrinsicContentSize])
    }

    @Test("the search field is the system's, so the sidebar's and a panel's match")
    func searchFieldIsNative() {
        let view = hosted()
        #expect(firstSearchField(in: view) != nil)
    }

    private func firstSearchField(in view: NSView) -> NSSearchField? {
        if let field = view as? NSSearchField { return field }
        for subview in view.subviews {
            if let field = firstSearchField(in: subview) { return field }
        }
        return nil
    }
}
