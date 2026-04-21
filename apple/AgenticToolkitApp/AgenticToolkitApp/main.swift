import AppKit
import Darwin

// True when a debugger is attached. Used to bypass single-instance
// enforcement under Xcode: rebuild-and-run briefly overlaps the old and new
// processes, which would otherwise silently reactivate the stale instance
// and exit the new one.
func isDebuggerAttached() -> Bool {
    var info = kinfo_proc()
    var mib: [Int32] = [CTL_KERN, KERN_PROC, KERN_PROC_PID, getpid()]
    var size = MemoryLayout<kinfo_proc>.stride
    guard sysctl(&mib, UInt32(mib.count), &info, &size, nil, 0) == 0 else { return false }
    return (info.kp_proc.p_flag & P_TRACED) != 0
}

// Single-instance enforcement (skip during unit tests and when debugging).
let isRunningTests = ProcessInfo.processInfo.environment["XCTestConfigurationFilePath"] != nil
if !isRunningTests && !isDebuggerAttached() {
    let myBundleID = Bundle.main.bundleIdentifier ?? "com.mikefullerton.AgenticPluginTester"
    let running = NSRunningApplication.runningApplications(withBundleIdentifier: myBundleID)
    if running.count > 1 {
        for app in running where app != NSRunningApplication.current {
            app.activate()
        }
        exit(0)
    }
}

let app = NSApplication.shared
// NSApplication.delegate is weak; hold a strong module-scope reference so
// the delegate survives past the assumeIsolated block.
let delegate = MainActor.assumeIsolated { AppDelegate() }
app.delegate = delegate
app.run()
