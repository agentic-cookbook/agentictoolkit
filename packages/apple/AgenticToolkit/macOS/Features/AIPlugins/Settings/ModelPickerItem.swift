import Foundation

/// One model row's data for the chooser: id plus any curated detail.
public struct ModelPickerItem: Equatable, Sendable {
    public let id: String
    public let description: String?
    public let tools: Bool?
    public let goodFor: String?

    public init(id: String, description: String? = nil, tools: Bool? = nil, goodFor: String? = nil) {
        self.id = id
        self.description = description
        self.tools = tools
        self.goodFor = goodFor
    }

    /// "Tools: Yes · Good for: …" — nil when neither is known.
    var capabilities: String? {
        var parts: [String] = []
        if let tools { parts.append("Tools: \(tools ? "Yes" : "No")") }
        if let goodFor, !goodFor.isEmpty { parts.append("Good for: \(goodFor)") }
        return parts.isEmpty ? nil : parts.joined(separator: " · ")
    }

    func matches(_ needle: String) -> Bool {
        id.lowercased().contains(needle)
            || (description?.lowercased().contains(needle) ?? false)
            || (goodFor?.lowercased().contains(needle) ?? false)
    }
}
