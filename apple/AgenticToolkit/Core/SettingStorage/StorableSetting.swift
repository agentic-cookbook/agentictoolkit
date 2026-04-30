//
//  StorableSetting.swift
//  AgenticToolkit
//
//  Created by Mike Fullerton on 4/27/26.
//

@MainActor
public protocol StorableSetting<Value> {
    associatedtype Value: Codable & Sendable

    var name: String { get }
    var isSecure: Bool { get }

    var defaultValue: Value { get }
}
