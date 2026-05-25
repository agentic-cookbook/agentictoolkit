# Code Review — WindowManager termination fix

| | |
|---|---|
| **Commit** | `739291e05d0e51d59beefe584e177672ea0f3d45` (`739291e`) |
| **Subject** | worktree-use-plugins (#48) |
| **Author** | Mike Fullerton |
| **Date** | 2026-05-25 14:56:26 -0700 |
| **Reviewed** | 2026-05-25 via `/dev-team code-review -1` (`atp review devteam -1 --llm claude`) |
| **Reviewers** | code-quality, codebase-decomposition, development-process, platform-ios-apple, reliability, security, software-architecture, testing-qa |
| **Issues found** | 41 |

A second pass over the same commit using the **codex** provider (11 issues, incl. one
this pass missed) is in
[`2026-05-25-windowmanager-termination-739291e-codex.md`](./2026-05-25-windowmanager-termination-739291e-codex.md).

## Scope

The diff under review is the **WindowManager termination fix**: the `isTerminating`
flag on `WindowManager`, the `NSApplication.willTerminateNotification` observer that
sets it, and the `windowWillClose` guard in `SingleWindowController` that stops
clobbering persisted window visibility during app quit — plus the accompanying
`WindowManagerTerminationTests`.

## Synthesis — 6 root causes

The 41 findings collapse into ~6 root causes; most are the same underlying issue
seen through different reviewer lenses.

### 1. No dependency-injection seam → tests mutate the `WindowManager.shared` singleton (~12 findings, sev 28–75)
`WindowManagerTerminationTests` writes `WindowManager.shared.isTerminating` directly and
relies on `defer` for cleanup. `defer` runs *after* the test body, so any test entering
with a dirty flag (leaked from a prior or parallel test) asserts against stale state.
`testUserCloseWhileRunningPersistsHidden` has no reset at all.
**Fix:** inject a `TerminationStateProviding` protocol into `SingleWindowController`;
add `setUp`/`tearDown` that reset the flag.

### 2. `windowWillClose` guard is asymmetric (~5 findings, sev 28–44)
The fix guards `saveVisibility(false)` behind `!isTerminating` but calls
`windowDidInteract(self, kind: .close)` **unconditionally**. If `.close` interaction
processing writes to recents/registry/analytics, the same bug resurfaces on that path
during quit.
**Fix:** apply the same termination guard to the interaction event, or make
`windowDidInteract` termination-aware.

### 3. Test posts the real `NSApplication.willTerminateNotification` to `NotificationCenter.default` (~6 findings, sev 8–55)
Process-wide broadcast — any other observer (AppKit internals, other fixtures) reacts.
**Fix:** drive the flag directly or use an injectable notification center.

### 4. Swift 6 actor-isolation gap (~4 findings, sev 14–58)
`WindowManager` isn't `@MainActor`, but `@objc handleAppWillTerminate` mutates
`isTerminating` while `SingleWindowController.windowWillClose` reads it — formally
unsynchronized. The `@objc` selector bridge bypasses concurrency checks.
**Fix:** `@MainActor`-annotate the handler, or use the closure-based
`addObserver(forName:object:queue:)`.

### 5. `object: nil` observer + `public` flag (~6 findings, sev 8–30, includes all 4 security findings)
`addObserver(... object: nil)` fires for *any* sender — an in-process plugin could post
a fake termination to latch `isTerminating = true`, permanently suppressing visibility
saves. And `public internal(set) var isTerminating` over-exposes lifecycle state across
the module boundary.
**Fix:** `object: NSApp` + drop to `internal`.

### 6. Convention + hygiene (sev 35–45)
- Multi-line comment blocks violate CLAUDE.md's "one short line max" (the 8-line class
  docblock + the 5-line guard comment).
- An unrelated `TEMP_*` PBXGroup UUID rename got bundled into the commit (XcodeGen
  re-run artifact).

### Lowest-hanging fruit
`object: nil` → `object: NSApp` (kills 4 findings incl. the security cluster), drop
`public` → `internal`, collapse the comment blocks, and add `setUp`/`tearDown` resets.
The structural items (DI seam, `@MainActor`, the asymmetric `.close` guard) are the
substantive phase-2 work.

## Full ranked findings

Format: `[sev N | conf M] reviewer — title (file:line)`.

### testing-qa — Singleton state not reset before each test — execution-order dependency
`[sev 75 | conf 85]` — `Tests/AgenticToolkitMacOSTests/CoreUI/WindowManagerTerminationTests.swift:17`

All three tests implicitly require `WindowManager.shared.isTerminating == false` at entry, but there is no `setUp` that guarantees this. The only reset is inside `defer` blocks in two of the three tests, which runs *after* the body, not before. If a prior test (within this suite or another) leaks `isTerminating = true`, subsequent tests can fail or produce wrong assertions before their own logic runs. `testUserCloseWhileRunningPersistsHidden` (line 79) asserts `XCTAssertFalse(WindowManager.shared.isTerminating)` with no reset at all — it relies entirely on the other tests having cleaned up correctly. Correct fix: add `override func setUp() { WindowManager.shared.isTerminating = false }` (and a matching `tearDown`) rather than sprinkling `defer` inside individual test bodies.

### testing-qa — `testWillTerminateNotificationSetsTerminatingFlag` asserts initial state before resetting it
`[sev 70 | conf 82]` — `Tests/AgenticToolkitMacOSTests/CoreUI/WindowManagerTerminationTests.swift:42`

Line 42 asserts `XCTAssertFalse(WindowManager.shared.isTerminating)` as a precondition, but the `defer` that resets the flag is the only guarantee of cleanup — and it runs *at the end of the function*, not at the start. If the singleton arrives in the dirty state (`isTerminating = true`) from a prior test run or a parallel suite, the precondition assert fires before any corrective reset can happen, making this test a false failure that looks like a broken implementation. The reset must be placed at the *top* of the test body (or in `setUp`) so the assertion is always testing a freshly initialized state.

### software-architecture — Service-locator access in windowWillClose violates DI
`[sev 65 | conf 90]` — `macOS/SystemIntegration/WindowManager/Windows/SingleWindowController.swift:238`

SingleWindowController.windowWillClose reads WindowManager.shared.isTerminating directly (line 238). This is a hidden global lookup — the controller reaches up to a concrete singleton rather than receiving the termination-awareness through an injected dependency. The consequence is hard coupling: SingleWindowController cannot be used, tested, or reused in any context that doesn't have a live WindowManager.shared, and changing how termination state is sourced requires modifying the class rather than swapping an injected value. The fix is a narrow protocol (e.g., TerminationStateProviding with a single isTerminating: Bool property) injected into SingleWindowController at init, with WindowManager conforming. This is also exactly what the tests are revealing: they must directly mutate the singleton because there is no injection seam.

### testing-qa — Mutation testing not verified — the critical boolean guard is trivially mutatable
`[sev 65 | conf 90]` — `macOS/SystemIntegration/WindowManager/Windows/SingleWindowController.swift:238`

The entire fix in `SingleWindowController.windowWillClose` is a single boolean inversion: `if !WindowManager.shared.isTerminating`. Muter would generate two surviving mutants instantly — invert the condition (`if WindowManager.shared.isTerminating`) and remove the guard entirely — and each mutant would invert the semantics of the bug being fixed. The three tests cover three distinct branches (termination-sets-flag, termination-close-skips-persist, running-close-persists-hidden), which *should* kill both mutants, but this has not been validated with Muter. Without a mutation-testing pass, confidence that the test suite actually exercises the guard is asserted but not proven.

### testing-qa — Real persistence written to disk inside unit tests — filesystem side effect
`[sev 62 | conf 75]` — `Tests/AgenticToolkitMacOSTests/CoreUI/WindowManagerTerminationTests.swift:57`

`showWindow()` in both `testTerminationCloseDoesNotClobberPersistedVisibility` (line 57) and `testUserCloseWhileRunningPersistsHidden` (line 76) triggers `WindowManager.shared.frames.saveVisibility`, which appears to write to UserDefaults or a similar persistent store on disk. Unit tests must not have filesystem side effects: they slow down the suite, depend on disk state from prior runs, and can produce unexpected interactions between parallel test processes. The `defer { WindowManager.shared.frames.clearVisibility(for: id) }` mitigates leakage but not the write itself. The correct fix is to inject a `FrameStore` protocol (or equivalent) and supply an in-memory fake in tests.

### platform-ios-apple — Missing @MainActor isolation on @objc handleAppWillTerminate
`[sev 58 | conf 72]` — `macOS/SystemIntegration/WindowManager/WindowManager.swift:64`

WindowManager is not declared @MainActor, yet isTerminating is read from @MainActor contexts (windowWillClose, the tests). handleAppWillTerminate is an @objc selector with no actor annotation; NSNotificationCenter delivers selector-based observers on whichever queue the notification was posted from, and willTerminateNotification is typically main-thread but not guaranteed. In Swift 6 strict concurrency this is a potential data race: the write in handleAppWillTerminate and the read in SingleWindowController.windowWillClose are unsynchronized unless both are provably main-actor-isolated. The fix is to annotate handleAppWillTerminate with @MainActor (and make WindowManager itself @MainActor, or at minimum mark isTerminating nonisolated(unsafe) with documented invariant).

### development-process — Fix relies on undocumented AppKit notification ordering (correctness risk for edge cases)
`[sev 58 | conf 62]` — `macOS/SystemIntegration/WindowManager/WindowManager.swift:54`

The entire fix is predicated on `willTerminateNotification` always firing before AppKit sends `windowWillClose:` to open windows. The comment cites a 'runtime probe' — empirical verification, not a documented guarantee. Normal graceful quit likely satisfies this ordering, but edge paths (programmatic `NSApp.terminate(nil)` called from a background actor, `applicationShouldTerminate` returning `.terminateLater` with a delayed reply, or macOS system-initiated termination under memory pressure) may or may not preserve the ordering. The phase-1 correctness goal is met for the common case, but phase-2 should enumerate the other termination paths and either verify or add a guard (e.g., checking `NSApp.isRunningModal`, using `applicationWillTerminate` in an NSApplicationDelegate delegate the WindowManager can register, or an explicit `prepareForTermination()` call from the app delegate before `NSApp.terminate`).

### code-quality — Real NSApplication.willTerminateNotification posted to global NotificationCenter in test
`[sev 55 | conf 75]` — `Tests/AgenticToolkitMacOSTests/CoreUI/WindowManagerTerminationTests.swift:46`

testWillTerminateNotificationSetsTerminatingFlag posts NSApplication.willTerminateNotification to NotificationCenter.default, which is process-wide. Any other observer in the test process — including AppKit's own internal machinery — will receive it. This is not a controlled stimulus; it is a side-effecting broadcast. The correct approach is to drive the flag directly (WindowManager.shared.isTerminating = true in a separate test) or to call the internal handler through a testable seam. The test already demonstrates the direct-set approach in testTerminationCloseDoesNotClobberPersistedVisibility — the notification test should be collapsed into a direct-flag test to remove the global blast radius.

### testing-qa — Posting real `NSApplication.willTerminateNotification` to `NotificationCenter.default` in a test
`[sev 55 | conf 68]` — `Tests/AgenticToolkitMacOSTests/CoreUI/WindowManagerTerminationTests.swift:44`

`testWillTerminateNotificationSetsTerminatingFlag` (line 44) posts `NSApplication.willTerminateNotification` on the process-wide `NotificationCenter.default` with `object: NSApp`. Any other registered observer in-process — from AppKit itself, from other framework code, or from other test fixtures that haven't yet torn down — will receive this notification and may take real termination actions. This introduces invisible coupling and potential for hard-to-reproduce test interference. The `WindowManager` observer should instead expose a testable seam (a method the observer calls, or an injectable notification center) so tests can exercise the behaviour without firing a process-wide signal.

### codebase-decomposition — Singleton mutation in tests creates fragile cross-test state dependency
`[sev 52 | conf 90]` — `Tests/AgenticToolkitMacOSTests/CoreUI/WindowManagerTerminationTests.swift:46`

Tests directly write to `WindowManager.shared.isTerminating` (a process-wide singleton) and rely on `defer` blocks to reset it. If a test throws before the deferred reset fires — or if XCTest parallelizes test cases on the same actor — the terminating flag leaks into unrelated test suites. The comment in `testWillTerminateNotificationSetsTerminatingFlag` explicitly acknowledges the leak risk. The root cause is that `WindowManager.shared` is a singleton with mutable state rather than an injectable dependency; tests cannot substitute an isolated instance. This is a structural coupling issue between the test infrastructure and the production singleton that `isTerminating` exposes as a settable path via `@testable`.

### development-process — Test posts real willTerminateNotification — may trigger unintended side-effects in process
`[sev 52 | conf 68]` — `Tests/AgenticToolkitMacOSTests/CoreUI/WindowManagerTerminationTests.swift:47`

testWillTerminateNotificationSetsTerminatingFlag posts NSApplication.willTerminateNotification to the default NotificationCenter with `object: NSApp`. Any other observer registered in the test process (AppKit internals, other framework components, host app code under test) will also fire, potentially producing teardown side effects or corrupting unrelated state mid-suite. The test only needs to verify that WindowManager reacts to the notification; since the test already has write access to `isTerminating` (via @testable), it can test the integration path more safely by setting the flag directly and separately verifying that handleAppWillTerminate sets it via a direct call, rather than broadcasting the real termination signal process-wide.

### software-architecture — Tests expose design flaw via direct singleton mutation
`[sev 50 | conf 88]` — `Tests/AgenticToolkitMacOSTests/CoreUI/WindowManagerTerminationTests.swift:43`

WindowManagerTerminationTests directly writes WindowManager.shared.isTerminating = true/false and calls WindowManager.shared.frames.clearVisibility(for:) in defer blocks to restore process-wide state (lines 43, 60–61, 77, 85). This is a test-as-canary signal: when tests must mutate a global to exercise a branch, the production code lacks an injection seam. The defer-based cleanup also relies on test-execution ordering and is fragile if a future test runner runs cases in parallel. The underlying fix is the DI change above; once TerminationStateProviding is injected, the test constructs a simple stub with isTerminating = true and no global state is touched.

### testing-qa — `windowWillClose` called directly — tests implementation detail, not observable behavior
`[sev 48 | conf 82]` — `Tests/AgenticToolkitMacOSTests/CoreUI/WindowManagerTerminationTests.swift:63`

Both `testTerminationCloseDoesNotClobberPersistedVisibility` (line 63) and `testUserCloseWhileRunningPersistsHidden` (line 82) invoke `windowController.windowWillClose(Notification(...))` directly. This couples the tests to the delegate-method name and bypasses AppKit's actual close path, which posts `NSWindow.willCloseNotification`. If the close logic is ever moved into a notification observer rather than the delegate method, the tests would pass without testing anything. A behaviorally-oriented test would either close the window through the standard API (`windowController.close()`) and assert the resulting persistence state, or at minimum post the real notification.

### code-quality — Multi-line comment blocks violate explicit project convention
`[sev 45 | conf 95]` — `Tests/AgenticToolkitMacOSTests/CoreUI/WindowManagerTerminationTests.swift:6`

CLAUDE.md states 'Never write multi-paragraph docstrings or multi-line comment blocks — one short line max.' Two violations: (1) the 8-line class-level docblock in WindowManagerTerminationTests.swift (lines 6-13) narrates the bug history — that belongs in a commit message or PR description, not source. (2) The 5-line comment block in SingleWindowController.windowWillClose (lines 238-243) re-explains what the guard condition already expresses. Each should be collapsed to a single sentence citing the test, or removed entirely.

### development-process — All three tests mutate WindowManager.shared — no per-test isolation
`[sev 45 | conf 82]` — `Tests/AgenticToolkitMacOSTests/CoreUI/WindowManagerTerminationTests.swift:42`

The suite reads and writes `WindowManager.shared.isTerminating` and `WindowManager.shared.frames` directly. Defer blocks reset state on clean exit, but test execution order is not guaranteed, and XCTest parallelism (even within-target) can interleave setUp/tearDown. If testWillTerminateNotificationSetsTerminatingFlag runs concurrently with testTerminationCloseDoesNotClobberPersistedVisibility, the isTerminating flag could be in an unexpected state when the second test evaluates it. A per-test WindowManager instance (injected via a factory or a reset method) would give each test a clean slate and make the fixture behavior explicit. The current singleton-plus-defer pattern is a phase-1 shortcut that the phase-2 refinement pass should address.

### reliability — Test posts real willTerminateNotification to shared NotificationCenter
`[sev 45 | conf 75]` — `Tests/AgenticToolkitMacOSTests/CoreUI/WindowManagerTerminationTests.swift:110`

testWillTerminateNotificationSetsTerminatingFlag posts NSApplication.willTerminateNotification to the default NotificationCenter with object: NSApp. Any other component in the test process registered for this notification (AppKit internals, other framework objects initialized during test setup) will also receive and react to it. This can silently corrupt process-level state or cause shutdown teardown logic to fire prematurely mid-suite, producing hard-to-diagnose flakiness. The test should post to a custom NotificationCenter or mock out the observer side rather than firing the real system notification.

### codebase-decomposition — `windowDidInteract(.close)` fires unconditionally during termination, potentially propagating side effects
`[sev 44 | conf 78]` — `macOS/SystemIntegration/WindowManager/Windows/SingleWindowController.swift:247`

In `SingleWindowController.windowWillClose`, the guard on `saveVisibility` is correct, but `WindowManager.shared.windowDidInteract(self, kind: .close)` is called regardless of `isTerminating`. Depending on what `.close` interaction processing does — recents recording, registry deregistration, analytics, or other observers on the interaction bus — this may persist or broadcast a closed state for windows that are only closing because the app is quitting. The fix is asymmetric: it guards one persistence path but not the interaction side-effects. If `.close` interactions are idempotent and only remove registry entries, this is benign; if they do more (e.g., write to recents or notify observers), the same bug resurfaces on a different path.

### testing-qa — Real AppKit window shown in unit tests — may be flaky in headless CI
`[sev 42 | conf 62]` — `Tests/AgenticToolkitMacOSTests/CoreUI/WindowManagerTerminationTests.swift:57`

`showWindow()` (lines 57 and 76) forces AppKit to materialize and display a real `NSWindow`. On macOS CI agents that run in a windowserver-less or off-screen environment, showing a window can silently fail, return without posting expected notifications, or raise an exception, all of which would cause incorrect persistence state and spurious test failures. Integration tests that exercise full AppKit windows belong in the functional test bundle (`StenographerFunctionalTests` equivalent), not in unit tests. The unit tests should spy on the persistence layer directly without requiring a real window.

### codebase-decomposition — Test tear-down incomplete: WindowRegistry entries not cleared after test controllers are destroyed
`[sev 41 | conf 72]` — `Tests/AgenticToolkitMacOSTests/CoreUI/WindowManagerTerminationTests.swift:56`

Both `testTerminationCloseDoesNotClobberPersistedVisibility` and `testUserCloseWhileRunningPersistsHidden` call `windowController.showWindow()`, which registers the controller with `WindowManager.shared.registry`. The `defer` blocks clean up `isTerminating` and `frames.clearVisibility`, but they do not deregister the `windowID` from the live registry. As the `TestWC` instance is deallocated at scope exit, the registry may hold a dangling weak/strong reference or a stale entry keyed to the UUID. Because `WindowManager.shared` is a singleton, these orphaned entries accumulate across the test run, which can affect other registry-querying tests or produce false positives in registry-count assertions.

### code-quality — Singleton state mutation creates test ordering dependency
`[sev 40 | conf 85]` — `Tests/AgenticToolkitMacOSTests/CoreUI/WindowManagerTerminationTests.swift:40`

All three tests manipulate WindowManager.shared.isTerminating on a process-wide singleton and rely on defer for cleanup. If a test fails with an uncaught exception before defer executes, subsequent tests inherit dirty state (isTerminating = true). More subtly, the notification observer registered in WindowManager.init is never deregistered between tests, so testWillTerminateNotificationSetsTerminatingFlag's NotificationCenter.default.post fires handleAppWillTerminate on the shared instance while the other tests' cleanup defer blocks are also in flight. The test acknowledges the coupling ('clear the flag so a terminating-state test can't leak') but the mitigation is incomplete — it only guards the flag, not the notification observer's side effects.

### development-process — windowDidInteract(.close) still fires during termination — inconsistent with skipped visibility save
`[sev 40 | conf 75]` — `macOS/SystemIntegration/WindowManager/Windows/SingleWindowController.swift:244`

SingleWindowController.windowWillClose now skips `saveVisibility(false)` during termination, which is correct. However, it still calls `WindowManager.shared.windowDidInteract(self, kind: .close)` unconditionally. If windowDidInteract has any downstream effects that depend on visibility state (analytics recording, recents list updates, HUD restore scheduling), those will fire with stale/inconsistent data during quit. The fix is half-complete: both the visibility save and the interaction event need the same termination guard, or windowDidInteract needs to be termination-aware. This is a phase-2 edge-case that the current phase-1 patch leaves open.

### platform-ios-apple — ObjC-style selector observer bypasses Swift 6 actor-isolation checks
`[sev 38 | conf 88]` — `macOS/SystemIntegration/WindowManager/WindowManager.swift:55`

The addObserver(_:selector:name:object:) + @objc selector pattern predates Swift Concurrency. In a Swift 6 strict-concurrency codebase the compiler cannot verify actor isolation across an @objc bridge, silently allowing the handler to run outside any actor. The native pattern is NotificationCenter.default.notifications(named: NSApplication.willTerminateNotification) consumed with for await in a Task, or the block-based addObserver(forName:object:queue:.main) with a closure. Either alternative surfaces isolation requirements at compile time and keeps the code consistent with the Swift 6 model used everywhere else in the framework.

### testing-qa — No property-based coverage of the termination × visibility state matrix
`[sev 38 | conf 80]` — `Tests/AgenticToolkitMacOSTests/CoreUI/WindowManagerTerminationTests.swift`

The fix creates a two-variable state space: `isTerminating` (true/false) × initial persisted visibility (true/false/nil) × window close event. Only two of the four meaningful combinations are tested (terminating + was-visible, running + was-visible). The combinations terminating-when-hidden (should not re-persist false — already false) and running-close-when-hidden are not covered. Swift Testing's parameterized tests or a simple loop over the matrix would close this gap and guarantee the guard holds for all input states, not just the regression scenario.

### software-architecture — WindowManager acquires a second responsibility: app-lifecycle observation
`[sev 38 | conf 78]` — `macOS/SystemIntegration/WindowManager/WindowManager.swift:53`

The init block in WindowManager.swift now registers an NSNotificationCenter observer for NSApplication.willTerminateNotification and introduces the isTerminating flag (lines 53–66). WindowManager was a window registry and frame/visibility store; it is now also an app-lifecycle observer. These are two distinct reasons to change: window management logic changes independently of how the app signals termination. A cleaner boundary would be a thin AppLifecycleMonitor (or similar) that observes the notification and drives a TerminationStateProviding protocol, leaving WindowManager focused on windows. This also makes the lifecycle concern independently testable without instantiating a WindowManager.

### development-process — isTerminating made public when internal suffices (YAGNI)
`[sev 38 | conf 72]` — `macOS/SystemIntegration/WindowManager/WindowManager.swift:27`

WindowManager.swift declares `public internal(set) var isTerminating`. The only production consumer of this property — SingleWindowController.windowWillClose — is in the same module (AgenticToolkitMacOS), so `internal` access is all that's needed there. Tests get write access via `@testable import`, which grants internal-level access regardless of how the getter is declared. Making the getter `public` adds framework API surface for no known today-requirement; if an external consumer needs it later, the visibility can be widened then. Premature publication means any downstream consumer can now depend on this flag, making it harder to rename or remove. Prefer `internal(set)` with no explicit access modifier (defaulting to `internal`).

### code-quality — Unrelated TEMP group UUID change bundled into commit
`[sev 35 | conf 80]` — `AgenticToolkit.xcodeproj/project.pbxproj:1940`

The pbxproj diff renames a 'Settings' PBXGroup from TEMP_DD701E47-2D55-40D3-8A9E-BFE28D4C9A8E to TEMP_2FCBD420-580D-4A47-B6EA-0D3165761375. Adding a test file to the project does not require regenerating or touching the Settings group. This is either an incidental XcodeGen re-run artifact or a hand-edit side-effect — either way it is a non-atomic change bundled into a focused bug-fix commit. If XcodeGen was re-run to add the test file, the re-run itself is fine, but the resulting noise should be reviewed: TEMP groups are placeholders and the rename suggests an underlying project.yml change that isn't in this diff.

### reliability — handleAppWillTerminate lacks explicit actor isolation in a Swift 6 module
`[sev 35 | conf 50]` — `macOS/SystemIntegration/WindowManager/WindowManager.swift:65`

handleAppWillTerminate is an @objc method that mutates isTerminating. NSApplication.willTerminateNotification is always posted on the main thread, so this is safe in practice, but the method carries no actor annotation. In a Swift 6 strict-concurrency module, if WindowManager is not @MainActor-isolated, the compiler may accept this but the mutation is formally unprotected. If WindowManager is @MainActor (not visible in the diff), the @objc selector path bypasses the actor hop. A nonisolated annotation or explicit MainActor.assumeIsolated call would make the isolation contract explicit and prevent a future refactor from introducing a real race.

### reliability — Observer registered with object: nil accepts any sender
`[sev 30 | conf 85]` — `macOS/SystemIntegration/WindowManager/WindowManager.swift:60`

The addObserver call passes object: nil, so it fires for any object that posts willTerminateNotification — not just NSApp. In production this is harmless, but in the test suite the notification-posting test fires with object: NSApp which happens to satisfy the nil filter. The broader risk: any test helper or future code that posts this notification from a different object will permanently flip isTerminating for the rest of the process lifetime, causing all subsequent windowWillClose calls to skip saveVisibility. Passing object: NSApp would narrow the filter to the only legitimate sender.

### codebase-decomposition — OS lifecycle cross-cutting concern embedded directly in WindowManager scope group
`[sev 28 | conf 82]` — `macOS/SystemIntegration/WindowManager/WindowManager.swift:30`

`WindowManager` now subscribes to `NSApplication.willTerminateNotification` and owns the `isTerminating` flag — an OS lifecycle concern — alongside its primary responsibilities of registry management, frame persistence, and recents tracking. By the codebase-decomposition lens, this is a cross-cutting concern (termination state) that two independent units — `WindowManager` and `SingleWindowController` — both depend on. It currently fails the 'removal test': if `isTerminating` were moved to a dedicated `AppLifecycleCoordinator`, both consumers would need to update. The flag is also `public`, expanding the API surface of `WindowManager` with state that conceptually belongs to the OS lifecycle layer. Low severity because the scope is small and the alternative (another object) may be over-engineering for a single boolean, but worth tracking if `WindowManager` accumulates more lifecycle-state dependencies.

### platform-ios-apple — Tests mutate process-wide singleton state without isolation seam
`[sev 28 | conf 78]` — `Tests/AgenticToolkitMacOSTests/CoreUI/WindowManagerTerminationTests.swift:43`

testWillTerminateNotificationSetsTerminatingFlag posts willTerminateNotification into the real NotificationCenter and relies on WindowManager.shared to receive it. testTerminationCloseDoesNotClobberPersistedVisibility directly writes WindowManager.shared.isTerminating = true. Both tests share no isolation seam — they depend on ordering, defer-based cleanup, and the absence of parallel test execution. The public internal(set) accessor was opened specifically to allow this test manipulation, which is a design smell. Injecting termination state (e.g., via a closure or protocol) would decouple the tests from the singleton and make them safe under -parallelize-tests.

### reliability — windowDidInteract(.close) fires unconditionally for termination-driven closes
`[sev 28 | conf 55]` — `macOS/SystemIntegration/WindowManager/Windows/SingleWindowController.swift:248`

The guard in windowWillClose protects saveVisibility but windowDidInteract(self, kind: .close) remains outside the guard and fires for every window AppKit closes during termination. If windowDidInteract records to a database, emits analytics, or enqueues async work, it will produce spurious 'close' events for windows the user did not explicitly dismiss. Depending on the implementation, those records could mislead session-restore logic or bloat interaction history. The same guard should wrap or inform the close interaction recording.

### code-quality — isTerminating exposed as public when it is an internal implementation detail
`[sev 25 | conf 70]` — `macOS/SystemIntegration/WindowManager/WindowManager.swift:30`

WindowManager.isTerminating is declared public internal(set), making the getter part of the framework's public API. The property is read only by SingleWindowController, which is in the same module, so internal access is sufficient. Exposing it publicly widens the API surface unnecessarily — external callers (plugins, host app) have no legitimate reason to inspect this flag. The @testable import in the test target already grants internal access, so the test usage does not require public visibility. Change to internal var isTerminating = false.

### platform-ios-apple — addObserver registers with object: nil, accepting synthetic senders
`[sev 22 | conf 85]` — `macOS/SystemIntegration/WindowManager/WindowManager.swift:56`

Registering with object: nil means any code that posts NSApplication.willTerminateNotification from an arbitrary sender (as the test itself does with object: NSApp but which is trivially spoofable) will latch isTerminating = true for the lifetime of the process. The registration should scope to the concrete sender (object: NSApp) so only AppKit's real termination sequence can flip the flag.

### security — Notification observer accepts spoofed termination signals (object: nil)
`[sev 22 | conf 82]` — `macOS/SystemIntegration/WindowManager/WindowManager.swift:62`

WindowManager registers for NSApplication.willTerminateNotification with object: nil, meaning the observer fires for any sender, not just NSApp. Any in-process code (a malicious plugin bundle, a buggy third-party framework, or an attacker with code-injection access) can post a fake notification to prematurely latch isTerminating = true. Once set, every subsequent SingleWindowController.windowWillClose call skips saving visible = false — so closing a window after the fake notification leaves it looking 'open' on the next launch. The fix is object: NSApp in the addObserver call, which constrains the observer to real application lifecycle events only.

### software-architecture — TestWC inherits SingleWindowController for fixture setup — prefer composition
`[sev 22 | conf 65]` — `Tests/AgenticToolkitMacOSTests/CoreUI/WindowManagerTerminationTests.swift:27`

TestWC: SingleWindowController (line 27) uses subclassing purely to produce a testable window controller with a known windowID and windowSpec. This is inheritance-for-convenience rather than an 'is-a' relationship: the test fixture just needs an instance that behaves like a window controller. If SingleWindowController accepted its WindowManager dependency via a protocol at init, the test could instead construct a real SingleWindowController with a stub provider and a fake window, eliminating the need for a subclass entirely. As a secondary consequence, TestWC must call super.init with a real contentViewController and relies on real AppKit behavior (loadView, windowStyleMask), making the test heavier than it needs to be.

### reliability — Initial-state assertion in test assumes no prior test leaked isTerminating
`[sev 20 | conf 65]` — `Tests/AgenticToolkitMacOSTests/CoreUI/WindowManagerTerminationTests.swift:109`

testWillTerminateNotificationSetsTerminatingFlag asserts XCTAssertFalse(WindowManager.shared.isTerminating) before posting the notification. If another test in the suite sets isTerminating = true and crashes or throws before its defer block runs, this assertion will fail spuriously — the test is checking behavior of a prior test rather than the feature under test. A setUp/tearDown fixture that unconditionally resets WindowManager.shared.isTerminating = false before each test would make the precondition authoritative and eliminate the ordering dependency.

### platform-ios-apple — No removeObserver call for selector-based registration
`[sev 14 | conf 92]` — `macOS/SystemIntegration/WindowManager/WindowManager.swift:53`

The selector-based addObserver form retains the observer until removeObserver(_:name:object:) is called; unlike block-based tokens it is not automatically cleaned up. WindowManager.shared is a process-lifetime singleton so there is no practical leak today, but the missing removeObserver violates the API contract and will become a real issue if the class is ever refactored into a non-singleton (e.g., per-scene window manager) or if a deinit is added. A deinit with NotificationCenter.default.removeObserver(self) should be added.

### software-architecture — @objc selector bridge for notification handler forgoes Swift-native closure form
`[sev 14 | conf 60]` — `macOS/SystemIntegration/WindowManager/WindowManager.swift:65`

handleAppWillTerminate is marked @objc private to satisfy the selector-based NotificationCenter.addObserver overload (line 65–67). The closure-based addObserver(forName:object:queue:using:) overload is purely Swift, avoids the ObjC bridge, and passes the notification as a typed argument — removing the need for the @objc annotation entirely. Minor in isolation, but the @objc form is a seam that bypasses Swift Concurrency's actor-isolation checking; the closure form would let the compiler verify that the handler executes on the expected context.

### codebase-decomposition — No `removeObserver` symmetry for `willTerminateNotification` registration
`[sev 12 | conf 88]` — `macOS/SystemIntegration/WindowManager/WindowManager.swift:55`

`NotificationCenter.default.addObserver` is called in the `WindowManager` initializer with no matching `removeObserver` in a deinitializer or `deinit`. For the current singleton pattern this is harmless — `WindowManager.shared` outlives the notification center and the app. However, the absence of teardown symmetry breaks the resource-ownership lifecycle pattern: if `WindowManager` ever becomes non-singleton (e.g., for scoped testing or multi-window-set contexts), each instance will permanently retain a notification observer that fires after deallocation. The initializer is currently the only place where observers are registered, and there is no `deinit` at all in this file.

### security — isTerminating exposed as public, leaks internal lifecycle state across module boundary
`[sev 12 | conf 88]` — `macOS/SystemIntegration/WindowManager/WindowManager.swift:28`

The isTerminating property is declared public internal(set), making the termination flag readable by all external consumers of AgenticToolkitMacOS (plugins, host apps, third-party integrations). This unnecessarily leaks internal app-lifecycle state beyond the framework boundary. Plugin bundles or other framework consumers can branch on this flag, coupling them to an internal invariant that has no defined API contract. The flag should be internal (or at most package-internal) unless there is a documented reason external modules must observe it. No cross-module consumer of this flag is shown in the diff.

### security — Test directly mutates process-wide singleton state without concurrency isolation
`[sev 8 | conf 70]` — `Tests/AgenticToolkitMacOSTests/CoreUI/WindowManagerTerminationTests.swift:47`

testWillTerminateNotificationSetsTerminatingFlag and testTerminationCloseDoesNotClobberPersistedVisibility both write directly to WindowManager.shared.isTerminating and use defer for cleanup. If XCTest runs these tests — or any future tests that depend on isTerminating == false — in parallel (async test execution or parallel test classes), the defer cleanup races with the next test's setup. Because WindowManager.shared is a process-wide singleton, a leaked isTerminating = true from one test would silently suppress visibility persistence in another, producing non-deterministic failures. The correct fix is to reset state in setUp/tearDown or use a dependency-injected WindowManager instance in tests rather than mutating the shared singleton.
