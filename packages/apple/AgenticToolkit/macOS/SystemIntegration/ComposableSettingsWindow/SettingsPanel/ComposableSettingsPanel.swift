//
//  ComposableSettingsPanel.swift
//  AgenticToolkit
//
//  Created by Mike Fullerton on 4/29/26.
//

import AppKit

@MainActor
public protocol ComposableSettingsPanel: NSViewController {
    var descriptor: ComposableSettings.SettingsPanelDescriptor { get }
//    func addGroup(_ group: ComposableSettings.GroupView)

    /// True when the panel manages its own scrolling (e.g. the theme editor).
    /// When false, the split hosts the panel inside a scroll view so oversized
    /// content scrolls instead of resizing the settings window.
    var hostsOwnScroll: Bool { get }

    /// Reference prose for this panel, shown in the detail pane's help drawer.
    ///
    /// `nil` is a panel with nothing to add, not a panel without a help button:
    /// the button belongs to the window, and hiding it per panel made it appear
    /// and vanish as the selection moved down the sidebar — and took an open
    /// drawer with it. A panel that offers no prose gets the drawer's own empty
    /// state instead, which says so.
    var helpContent: ComposableSettings.PanelHelp? { get }

    /// The help actually shown while this panel is on screen. Same thing as
    /// `helpContent` for a plain panel — but a panel that holds a selection of
    /// its own (a nested topic list, a tab view) answers with whatever is
    /// selected *inside* it, because that is what the reader is looking at.
    /// Only the window's outermost split has a help presenter, so an inner
    /// selection's help has to travel outwards to be shown at all.
    var effectiveHelpContent: ComposableSettings.PanelHelp? { get }

    /// Words this panel should be findable by that its view does not spell out.
    ///
    /// The sidebar's search reads the labels off any panel that is already
    /// built, but it never builds one to look inside it — constructing every
    /// panel on the first keystroke is the work lazy panels exist to avoid, and
    /// it runs their side effects for a reader who typed one letter. Keywords
    /// are how a panel stays findable *before* it is first opened, and the only
    /// way a SwiftUI-hosted one is findable at all: its controls are not AppKit
    /// labels to read.
    var searchKeywords: [String] { get }
}

public extension ComposableSettingsPanel {
    var hostsOwnScroll: Bool { false }

    var helpContent: ComposableSettings.PanelHelp? { nil }

    var effectiveHelpContent: ComposableSettings.PanelHelp? { helpContent }

    var searchKeywords: [String] { [] }
}
