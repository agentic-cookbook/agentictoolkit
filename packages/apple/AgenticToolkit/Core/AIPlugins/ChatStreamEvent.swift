//
//  ChatStreamEvent.swift
//  AgenticToolkit
//
//  Created by Mike Fullerton on 4/30/26.
//

import Foundation

/// One event in the assistant response stream produced by the tool-aware
/// `sendMessages` overload. Text-only backends only emit `.textDelta` and
/// `.end`; tool-capable backends additionally emit `.toolUse` for each call
/// the model wants to make.
public enum ChatStreamEvent: Sendable {
    case textDelta(String)
    case toolUse(id: String, name: String, argumentsJSON: Data)
    case end(stopReason: String?)
}
