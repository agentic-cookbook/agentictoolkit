//
//  UserSettings.swift
//  AgenticToolkit
//
//  Created by Mike Fullerton on 4/27/26.
//

@MainActor
public class UserSettings: SettingsStore {
    /// Client apps should create and set this
    public static var shared = UserSettings()
}

extension StorableSetting {
    public  var value: Value {
        get { UserSettings.shared.get(self) }
        nonmutating set { UserSettings.shared.set(newValue, for: self) }
    }
    
    public func remove() {
        UserSettings.shared.remove(self)
    }
    
    public func existsInStore() -> Bool {
        UserSettings.shared.contains(self)
    }
}

public struct UserSetting<Value: Codable & Sendable>: StorableSetting {
    
    public let name: String
    
    public let isSecure: Bool
    
    public let defaultValue: Value
    
    public init(_ name: String, default defaultValue: Value, isSecure: Bool = false) {
        self.name = name
        self.isSecure = isSecure
        self.defaultValue = defaultValue
    }
}
