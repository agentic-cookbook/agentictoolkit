import Foundation
import Testing
@testable import AgenticToolkitPermissions

/// Records the last probe call and returns a configured status.
private final class ProbeRecorder: @unchecked Sendable {
    var lastBundleID: String?
    var lastPromptIfNeeded: Bool?
}

private struct StubAutomationProbe: AutomationProbing {
    let status: OSStatus
    let recorder: ProbeRecorder

    func permissionStatus(forBundleID bundleID: String, promptIfNeeded: Bool) -> OSStatus {
        recorder.lastBundleID = bundleID
        recorder.lastPromptIfNeeded = promptIfNeeded
        return status
    }
}

@Suite("Automation permission mapping")
struct AutomationMappingTests {
    private func checker(_ status: OSStatus, _ recorder: ProbeRecorder = ProbeRecorder()) -> SystemPermissionChecker {
        SystemPermissionChecker(automationProbe: StubAutomationProbe(status: status, recorder: recorder))
    }

    @Test("noErr means granted")
    func granted() async {
        #expect(await checker(noErr).isGranted(.automation(targetBundleID: "com.googlecode.iterm2")))
    }

    @Test("errAEEventNotPermitted (-1743) means not granted")
    func denied() async {
        #expect(await checker(-1743).isGranted(.automation(targetBundleID: "com.googlecode.iterm2")) == false)
    }

    @Test("consent-required (-1744) means not granted")
    func consentRequired() async {
        #expect(await checker(-1744).isGranted(.automation(targetBundleID: "x")) == false)
    }

    @Test("isAutomationGranted maps statuses")
    func mapping() {
        #expect(SystemPermissionChecker.isAutomationGranted(noErr) == true)
        #expect(SystemPermissionChecker.isAutomationGranted(-1743) == false)
        #expect(SystemPermissionChecker.isAutomationGranted(-1744) == false)
        #expect(SystemPermissionChecker.isAutomationGranted(-600) == false)
    }

    @Test("checking does not prompt, requesting does; bundle id is forwarded")
    func promptFlag() async {
        let recorder = ProbeRecorder()
        let checker = checker(noErr, recorder)

        _ = await checker.isGranted(.automation(targetBundleID: "com.googlecode.iterm2"))
        #expect(recorder.lastBundleID == "com.googlecode.iterm2")
        #expect(recorder.lastPromptIfNeeded == false)

        _ = await checker.request(.automation(targetBundleID: "com.googlecode.iterm2"))
        #expect(recorder.lastPromptIfNeeded == true)
    }
}
