import Foundation

/// A Sendable, Codable JSON tree — the payload type for schema-flexible sync
/// rows (spec: "Mirror storage is schema-flexible by design").
public enum JSONValue: Codable, Sendable, Equatable, Hashable {
    case null
    case bool(Bool)
    case number(Double)
    case string(String)
    case array([JSONValue])
    case object([String: JSONValue])

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self = .null
        } else if let boolValue = try? container.decode(Bool.self) {
            self = .bool(boolValue)
        } else if let numberValue = try? container.decode(Double.self) {
            self = .number(numberValue)
        } else if let stringPayload = try? container.decode(String.self) {
            self = .string(stringPayload)
        } else if let arrayValue = try? container.decode([JSONValue].self) {
            self = .array(arrayValue)
        } else if let objectValue = try? container.decode([String: JSONValue].self) {
            self = .object(objectValue)
        } else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "not JSON")
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .null: try container.encodeNil()
        case .bool(let boolValue): try container.encode(boolValue)
        case .number(let numberValue): try container.encode(numberValue)
        case .string(let stringPayload): try container.encode(stringPayload)
        case .array(let arrayValue): try container.encode(arrayValue)
        case .object(let objectValue): try container.encode(objectValue)
        }
    }

    public subscript(key: String) -> JSONValue? {
        if case .object(let objectValue) = self { return objectValue[key] }
        return nil
    }

    public var stringValue: String? {
        if case .string(let stringPayload) = self { return stringPayload }
        return nil
    }

    public var isNull: Bool {
        if case .null = self { return true }
        return false
    }
}
