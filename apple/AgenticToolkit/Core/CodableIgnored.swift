//
//  CodableIgnored.swift
//  AgenticToolkit
//
//  Created by Mike Fullerton on 4/27/26.
//

@propertyWrapper
public struct CodableIgnored<T>: Codable {
    public var wrappedValue: T?

    public init(wrappedValue: T?) {
        self.wrappedValue = wrappedValue
    }

    public init(from decoder: Decoder) throws {
        self.wrappedValue = nil
    }

    public func encode(to encoder: Encoder) throws {
        // Intentionally empty — encoding is suppressed at the container level below
    }
}

extension KeyedDecodingContainer {
    public func decode<T>(
        _ type: CodableIgnored<T>.Type,
        forKey key: Self.Key
    ) throws -> CodableIgnored<T> {
        return CodableIgnored(wrappedValue: nil)
    }
}

extension KeyedEncodingContainer {
    public mutating func encode<T>(
        _ value: CodableIgnored<T>,
        forKey key: KeyedEncodingContainer<K>.Key
    ) throws {
        // No-op: skip encoding entirely so the key never appears in output
    }
}
