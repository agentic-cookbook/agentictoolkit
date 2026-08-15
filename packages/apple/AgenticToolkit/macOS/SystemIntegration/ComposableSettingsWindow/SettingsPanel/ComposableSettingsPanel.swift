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
    /// `nil` retires the help button for this panel entirely — better than an
    /// empty drawer, which promises an explanation and then withholds it.
    var helpContent: ComposableSettings.PanelHelp? { get }
}

public extension ComposableSettingsPanel {
    var hostsOwnScroll: Bool { false }

    var helpContent: ComposableSettings.PanelHelp? { nil }
}
