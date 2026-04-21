import Testing
import Foundation
@testable import AgenticToolkitScripting

/// `AppleScriptRunner.run` compiles and executes scripts via `NSAppleScript`.
/// Tests here stick to scripts that don't touch other applications — a plain
/// `return` expression or an explicit `error` — so they don't trip the AppKit
/// sandbox / Automation permission prompts that `tell application ...` does.
@Suite("AppleScriptRunner", .serialized)
struct AppleScriptRunnerTests {

    // TODO: Exercise the `.compileFailed` path. Empirically `NSAppleScript(source:)`
    // never returns nil — it accepts any string and defers all syntax/tokenizer
    // errors to `executeAndReturnError` (surfaced as `.runtimeFailed`). The
    // `.compileFailed` enum case exists as a defensive catch, but no observed
    // input reaches it via `AppleScriptRunner.run(_:)`.

    @Test("simple return string yields .success with that string")
    func successReturnsString() {
        let result = AppleScriptRunner.run("return \"hello\"")
        #expect(result == .success("hello"))
    }

    @Test("numeric return is stringified by NSAppleScript")
    func successReturnsNumericString() {
        let result = AppleScriptRunner.run("return 42")
        #expect(result == .success("42"))
    }

    @Test("explicit error raises .runtimeFailed with the message")
    func runtimeFailed() {
        let result = AppleScriptRunner.run("error \"boom\" number -1728")
        switch result {
        case .runtimeFailed(let message, let number):
            #expect(message.contains("boom"))
            #expect(number == -1728)
        default:
            Issue.record("expected .runtimeFailed, got \(result)")
        }
    }

    @Test("empty source compiles and returns .success(nil)")
    func emptySourceSucceeds() {
        // NSAppleScript accepts empty source; execution returns a null descriptor
        // whose stringValue is nil.
        let result = AppleScriptRunner.run("")
        #expect(result == .success(nil))
    }
}
