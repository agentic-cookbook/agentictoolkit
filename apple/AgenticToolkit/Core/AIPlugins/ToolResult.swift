//
//  ToolResult.swift
//  AgenticToolkit
//
//  Created by Mike Fullerton on 4/30/26.
//

import Foundation

/// The outcome of running one tool the model called. The chat dispatch loop
/// builds these from MCP responses and threads them back into the next
/// `sendMessages` call as part of the conversation history.
public struct ToolResult: Sendable, Hashable {
    public let toolUseId: String
    public let content: String
    public let isError: Bool

    public init(toolUseId: String, content: String, isError: Bool) {
        self.toolUseId = toolUseId
        self.content = content
        self.isError = isError
    }
}
