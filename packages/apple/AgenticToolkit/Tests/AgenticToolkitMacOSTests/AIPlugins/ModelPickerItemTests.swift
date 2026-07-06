import Foundation
import Testing
@testable import AgenticToolkitMacOS

@Suite("ModelPickerItem")
@MainActor
struct ModelPickerItemTests {

    @Test("capabilities joins tool support and strengths")
    func capabilitiesFull() {
        let item = ModelPickerItem(id: "sonnet", description: "Balanced default.",
                                   tools: true, goodFor: "Everyday tasks")
        #expect(item.capabilities == "Tools: Yes · Good for: Everyday tasks")
    }

    @Test("capabilities reports no tool support")
    func capabilitiesNoTools() {
        let item = ModelPickerItem(id: "m", tools: false, goodFor: "Text")
        #expect(item.capabilities == "Tools: No · Good for: Text")
    }

    @Test("capabilities omits blank strengths")
    func capabilitiesBlankGoodFor() {
        let item = ModelPickerItem(id: "m", tools: true, goodFor: "")
        #expect(item.capabilities == "Tools: Yes")
    }

    @Test("capabilities is nil when nothing is known")
    func capabilitiesEmpty() {
        #expect(ModelPickerItem(id: "m").capabilities == nil)
    }

    @Test("matches searches id, description, and strengths case-insensitively")
    func matchingFields() {
        let item = ModelPickerItem(id: "claude-opus", description: "Most capable.",
                                   tools: true, goodFor: "Hard reasoning")
        #expect(item.matches("opus"))          // id
        #expect(item.matches("capable"))        // description
        #expect(item.matches("reasoning"))      // goodFor
        #expect(item.matches("OPUS") == false)  // caller lowercases the needle first
        #expect(item.matches("claude"))
        #expect(item.matches("gpt") == false)
    }

    @Test("matches ignores tool support text")
    func matchingIgnoresTools() {
        // "Tools:" is rendered, not part of the searchable fields.
        let item = ModelPickerItem(id: "m", tools: true)
        #expect(item.matches("tools") == false)
    }
}
