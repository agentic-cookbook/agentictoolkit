//
//  Loggable.swift
//  AgenticToolkit
//
//  Created by Mike Fullerton on 4/22/26.
//

import Foundation
import OSLog

/// Mix this into any struct or class like this
/*
 struct MyStruct {
    // stuff
 }
 
 extension MyStruct: Loggable {
    public static let logger = makeLogger()
 }
 */
public protocol Loggable {
    
    /// Implement this by simplly calling makeLogger
    /// public static let logger = makeLogger()
    static nonisolated var logger: Logger { get }
}

extension Loggable {
    public static var subsystem: String {
        Bundle.main.bundleIdentifier ?? "nil"
    }

    public static var category: String {
        "\(type(of: self))".replacingOccurrences(of: ".Type", with: "")
    }

    public var logger: Logger {
        Self.logger
    }
    
    public static func makeLogger() -> Logger {
        Logger(subsystem: self.subsystem, category: self.category)
    }
}
