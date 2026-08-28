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
}

public extension ComposableSettingsPanel {
    var hostsOwnScroll: Bool { false }

    var helpContent: ComposableSettings.PanelHelp? { nil }
}
