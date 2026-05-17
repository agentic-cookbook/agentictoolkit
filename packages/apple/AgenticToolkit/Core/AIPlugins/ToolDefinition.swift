//
//  ToolDefinition.swift
//  AgenticToolkit
//
//  Created by Mike Fullerton on 4/30/26.
//

import Foundation

/// A tool that the model can call. Backends translate this into the
/// provider-specific shape (Anthropic `tools`, OpenAI `functions`, etc.)
/// before sending the request.
public struct ToolDefinition: Sendable, Hashable {
    public let name: String
    public let description: String
    public let parametersJSONSchema: Data

    public init(name: String, description: String, parametersJSONSchema: Data) {
        self.name = name
        self.description = description
        self.parametersJSONSchema = parametersJSONSchema
    }
}
