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
    var settingsLayout: ComposableSettings.SettingsLayout { get set }
    func addGroup(_ group: ComposableSettings.GroupView)
}
