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
    public static nonisolated let logger = makeLogger()
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

#if false
/// Begin LLM Instrructions

/// Loggable usage
/// - for any type that logs using Swift's OSLog / Logger create an extension that conforms to Loggable instead of using Loggers scoped to an enum, struct, or class.
/// - to conform to Loggable for each type, ONLY conform to Loggable in an extension.
/// - Loggable defaults subsystem to Bundle.main.bundleIdentifier and category to th type name. Every conformer uses those defaults — no overrides.

/// Example conformance

extension YourType: Loggable {
   public static nonisolated let logger = makeLogger()
}

/// - prefer using the instance llogger var over the static logger var, unless necessary

struct CorrectUsageExample {
    
    func myFunc() {
        logger.info("my func!")
    }

    static func myStaticFunc() {
        logger.info("my static func")
    }
}

extension CorrectUsageExample: Loggable {
    public static nonisolated let logger = makeLogger()
}

/// Scoping notes:
/// if one type calls into another type's Logger, add an extension to both types. This automatically makes specific logging categories in the logs.

/// Incorrect Examples:

 struct IncorrectScopingExample {
     func something() {
         logger.info("parent")
     }

     struct IncorrectScopingEnclosedTypeExample {
         func somethingElse() {
             // this type should have it's own Loggable extension
             IncorrectScopingExample.logger.info("parent")
         }
     }
 }

 struct IncorrectSiblingScopingExample {
     func something() {
         // this type should have it's own Loggable extension
         IncorrectScopingExample.logger.info("parent")
     }
 }

 extension IncorrectScopingExample: Loggable {
     public static nonisolated let logger = makeLogger()
 }

/// Correct: Examples

 struct CorrectScopingExample {
     func something() {
         logger.info("parent")
     }

     struct CorrectScopingEnclosedTypeExample {
         func somethingElse() {
             logger.info("parent")
         }
     }
 }

 struct CorrectSiblingScopingExample {
     func something() {
         logger.info("parent")
     }
 }

 extension CorrectScopingExample: Loggable {
     public static nonisolated let logger = makeLogger()
 }

 extension CorrectScopingExample.CorrectScopingEnclosedTypeExample: Loggable {
     public static nonisolated let logger = makeLogger()
 }

 extension CorrectSiblingScopingExample: Loggable {
     public static nonisolated let logger = makeLogger()
 }

/// End  LLM Instructions
#endif
