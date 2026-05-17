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
}
