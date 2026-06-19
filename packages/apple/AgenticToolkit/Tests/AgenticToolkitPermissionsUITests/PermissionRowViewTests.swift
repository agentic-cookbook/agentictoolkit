import AppKit
import Testing
import AgenticToolkitPermissions
@testable import AgenticToolkitPermissionsUI

private struct StubChecker: PermissionChecking {
    let granted: Bool
    func isGranted(_ permission: Permission) async -> Bool { granted }
    func request(_ permission: Permission) async -> Bool { granted }
}

@MainActor
@Suite("Permission row view")
struct PermissionRowViewTests {
    @Test("row shows Granted when the checker reports granted")
    func showsGranted() async {
        let row = PermissionRowView(
            permission: .accessibility,
            checker: StubChecker(granted: true),
            onAction: { _ in }
        )
        await row.refresh()
        #expect(row.statusText == "Granted")
    }

    @Test("row shows Not Granted when the checker reports denied")
    func showsDenied() async {
        let row = PermissionRowView(
            permission: .automation(targetBundleID: "com.googlecode.iterm2"),
            checker: StubChecker(granted: false),
            onAction: { _ in }
        )
        await row.refresh()
        #expect(row.statusText == "Not Granted")
    }
}
