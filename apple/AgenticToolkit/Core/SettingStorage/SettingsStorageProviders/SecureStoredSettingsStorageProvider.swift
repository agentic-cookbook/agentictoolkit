//
//  SecureSettingsStorageProvider.swift
//  AgenticToolkit
//
//  Created by Mike Fullerton on 4/27/26.
//

public protocol SecureSettingsStorageProvider: SettingsStorageProvider {
}

public extension SecureSettingsStorageProvider {
    var isSecure: Bool { true }
}
