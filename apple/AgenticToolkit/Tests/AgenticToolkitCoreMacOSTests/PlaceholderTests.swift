import Testing
@testable import AgenticToolkitCoreMacOS

@Suite("AgenticToolkitCoreMacOS placeholder")
struct AgenticToolkitCoreMacOSPlaceholderTests {
    @Test("module compiles")
    func moduleCompiles() {
        // Reference any public type to confirm the module links.
        _ = SingleWindowController.self
    }
}
