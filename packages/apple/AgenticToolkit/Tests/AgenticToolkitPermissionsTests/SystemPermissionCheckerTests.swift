import Foundation
import Testing
import UserNotifications
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

    @Test("noErr maps to granted")
    func granted() async {
        #expect(await checker(noErr).status(.automation(targetBundleID: "com.googlecode.iterm2")) == .granted)
    }

    @Test("errAEEventNotPermitted (-1743) maps to denied")
    func denied() async {
        #expect(await checker(-1743).status(.automation(targetBundleID: "com.googlecode.iterm2")) == .denied)
    }

    @Test("consent-required (-1744) and target-not-running (-600) map to undetermined, not denied")
    func undetermined() async {
        #expect(await checker(-1744).status(.automation(targetBundleID: "x")) == .undetermined)
        #expect(await checker(-600).status(.automation(targetBundleID: "x")) == .undetermined)
    }

    @Test("automationStatus maps OSStatus values to the tri-state")
    func mapping() {
        #expect(SystemPermissionChecker.automationStatus(noErr) == .granted)
        #expect(SystemPermissionChecker.automationStatus(-1743) == .denied)
        #expect(SystemPermissionChecker.automationStatus(-1744) == .undetermined)
        #expect(SystemPermissionChecker.automationStatus(-600) == .undetermined)
    }

    @Test("notificationStatus: notDetermined is undetermined, not denied")
    func notificationMapping() {
        #expect(SystemPermissionChecker.notificationStatus(.authorized) == .granted)
        #expect(SystemPermissionChecker.notificationStatus(.denied) == .denied)
        #expect(SystemPermissionChecker.notificationStatus(.notDetermined) == .undetermined)
    }

    @Test("isGranted convenience is true only for .granted")
    func isGrantedConvenience() async {
        #expect(await checker(noErr).isGranted(.automation(targetBundleID: "x")) == true)
        #expect(await checker(-1743).isGranted(.automation(targetBundleID: "x")) == false)
        #expect(await checker(-600).isGranted(.automation(targetBundleID: "x")) == false)
    }

    @Test("status does not prompt, request does; bundle id is forwarded")
    func promptFlag() async {
        let recorder = ProbeRecorder()
        let checker = checker(noErr, recorder)

        _ = await checker.status(.automation(targetBundleID: "com.googlecode.iterm2"))
        #expect(recorder.lastBundleID == "com.googlecode.iterm2")
        #expect(recorder.lastPromptIfNeeded == false)

        _ = await checker.request(.automation(targetBundleID: "com.googlecode.iterm2"))
        #expect(recorder.lastPromptIfNeeded == true)
    }
}
