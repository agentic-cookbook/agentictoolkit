# Code Review (codex) — WindowManager termination fix

| | |
|---|---|
| **Commit** | `739291e05d0e51d59beefe584e177672ea0f3d45` (`739291e`) |
| **Subject** | worktree-use-plugins (#48) |
| **Author** | Mike Fullerton |
| **Date** | 2026-05-25 14:56:26 -0700 |
| **Reviewed** | 2026-05-25 via `/dev-team code-review -1 --llm codex` (`atp review devteam -1 --llm codex`) |
| **Reviewers** | code-quality, development-process, platform-ios-apple, reliability, security, software-architecture, testing-qa |
| **Issues found** | 11 |

This is a second pass over the same commit using the **codex** provider. See
[`2026-05-25-windowmanager-termination-739291e.md`](./2026-05-25-windowmanager-termination-739291e.md)
for the **claude** pass (41 issues) and full per-finding detail on the overlapping items.

## Scope

The diff under review is the **WindowManager termination fix**: the `isTerminating`
flag on `WindowManager`, the `NSApplication.willTerminateNotification` observer that
sets it, and the `windowWillClose` guard in `SingleWindowController` that stops
clobbering persisted window visibility during app quit — plus the accompanying
`WindowManagerTerminationTests`.

## Headline — the finding claude missed

Codex's top finding (sev 88, conf 95, raised by 3 reviewers) is one the claude pass
did **not** surface at all:

> **The test was added only to the generated `project.pbxproj`, not to `project.yml`.**

Per this repo's own CLAUDE.md, `project.yml` is the source of truth and hand-edits to
`project.pbxproj` are lost on the next `cc-xcgen` run — so the new regression coverage
will silently disappear after the next project regeneration. This is the highest-impact
issue in either review pass.

## Full ranked findings

Format: `[sev N | conf M] reviewer — title (file:line)`.

### code-quality — Generated Xcode project edited without source-of-truth update
`[sev 88 | conf 95]` — `AgenticToolkit.xcodeproj/project.pbxproj:308`

The change adds the test only to `project.pbxproj`, but this repo declares `project.yml` as the source of truth and says hand-edits to `project.pbxproj` are lost on regeneration. This means the test target membership can disappear after XcodeGen, and the change has not completed the post-generation verification loop.

### testing-qa — Tests mutate process-wide termination singleton
`[sev 82 | conf 88]` — `Tests/AgenticToolkitMacOSTests/CoreUI/WindowManagerTerminationTests.swift:42`

The new tests read and write `WindowManager.shared.isTerminating`, a process-wide singleton flag, but there is no `setUp`/`tearDown` that establishes a clean baseline before every test. `testUserCloseWhileRunningPersistsHidden` assumes the flag is already false, so this suite can become execution-order dependent if another test in the process leaves the singleton in a terminating state or if a future test is added without careful cleanup. Shared mutable test state is exactly the kind of intermittent failure risk this change should avoid.

### development-process — Test is wired only in generated Xcode project
`[sev 76 | conf 90]` — `AgenticToolkit.xcodeproj/project.pbxproj:308`

The repo instructions state that `project.yml` is the source of truth for Apple Xcode projects and hand-edits to `project.pbxproj` are lost on regeneration. This change adds `WindowManagerTerminationTests.swift` directly to `project.pbxproj` without a corresponding `project.yml` update, so the regression coverage can silently disappear after the next XcodeGen run. Wire the test through the XcodeGen manifest and regenerate the project file.

### testing-qa — Unit tests post real app termination notification
`[sev 76 | conf 84]` — `Tests/AgenticToolkitMacOSTests/CoreUI/WindowManagerTerminationTests.swift:47`

`testWillTerminateNotificationSetsTerminatingFlag` posts `NSApplication.willTerminateNotification` on `NotificationCenter.default` with `NSApp`. That is a real, global app-lifecycle notification, so any observer in this test process can react as though the app is terminating. This makes the test non-isolated and vulnerable to cross-test side effects. Prefer injecting a notification center into `WindowManager`, using a private center in tests, or exposing a narrow test seam for the termination transition.

### software-architecture — Generated Xcode project was hand-edited
`[sev 72 | conf 95]` — `AgenticToolkit.xcodeproj/project.pbxproj:308`

The repo instructions state that `project.yml` is the source of truth and hand edits to `project.pbxproj` are lost on regeneration. Adding `WindowManagerTerminationTests.swift` only to the generated project file makes the build graph fragile; the test target membership should be represented in the XcodeGen source instead so future project regeneration does not silently drop the coverage.

### testing-qa — Unit tests use real persisted window visibility store
`[sev 70 | conf 80]` — `Tests/AgenticToolkitMacOSTests/CoreUI/WindowManagerTerminationTests.swift:58`

The tests call `WindowManager.shared.frames.saveVisibility/loadVisibility/clearVisibility` through real `showWindow` and `windowWillClose` behavior. If `frames` is backed by UserDefaults or another persistent store, these are filesystem-backed side effects in unit tests. UUID keys reduce collisions, but the test still depends on real persistence and cleanup. This should use an injected fake visibility store or a test-scoped suite/store so the test remains deterministic and isolated.

### code-quality — Termination flag is exposed as public API
`[sev 62 | conf 90]` — `macOS/SystemIntegration/WindowManager/WindowManager.swift:30`

`isTerminating` is an implementation detail used only to coordinate `WindowManager` and `SingleWindowController`, but it is declared `public internal(set)`, expanding the framework's public surface with ambient lifecycle state. Keeping this internal would avoid locking in a maintenance liability and hidden global behavior for consumers.

### software-architecture — Termination state is exposed as global mutable application state
`[sev 58 | conf 82]` — `macOS/SystemIntegration/WindowManager/WindowManager.swift:30`

`WindowManager.isTerminating` adds publicly readable, internally mutable process-wide state and `SingleWindowController` reaches into `WindowManager.shared` to branch on it. That makes window close behavior depend on hidden global lifecycle state rather than a small injected port or explicit close context, increasing coupling between UI controllers, app lifecycle, persistence, and tests. It also forces tests to mutate singleton state directly, which is a sign the boundary is too broad.

### code-quality — Unrelated generated project churn included
`[sev 45 | conf 85]` — `AgenticToolkit.xcodeproj/project.pbxproj:1940`

The `TEMP_*` group identifier changes even though the logical change is termination visibility persistence and test coverage. This looks like generated or incidental project-file churn, which weakens atomicity and makes the commit harder to review or regenerate predictably.

### software-architecture — Close persistence policy remains embedded in the window controller
`[sev 43 | conf 76]` — `macOS/SystemIntegration/WindowManager/Windows/SingleWindowController.swift:238`

The new termination rule is implemented inside `SingleWindowController.windowWillClose(_:)`, which already coordinates AppKit delegate events, visibility persistence, recents interaction, and now application lifecycle semantics. This gives the controller multiple reasons to change. A focused visibility persistence policy or lifecycle-aware adapter behind `WindowManager` would keep the controller thinner and make future close reasons easier to add without expanding UI delegate logic.

### reliability — Termination close still records a close interaction
`[sev 42 | conf 68]` — `macOS/SystemIntegration/WindowManager/Windows/SingleWindowController.swift:247`

The fix prevents visibility from being clobbered during app termination, but still calls `WindowManager.shared.windowDidInteract(self, kind: .close)` for termination-driven `windowWillClose` events. If `windowDidInteract` persists recents, timestamps, or other user-interaction state, app shutdown can still write misleading close activity for every visible window. From a reliability/idempotency lens, teardown callbacks should avoid user-action side effects or mark them as termination-originated so repeated shutdown processing cannot corrupt interaction state.

## Comparison: codex vs claude

| | claude pass | codex pass |
|---|---|---|
| Issues found | 41 | 11 |
| Reviewers | 8 (incl. codebase-decomposition) | 7 |
| Top severity | 75 | 88 |
| Character | broad, many duplicates across lenses | tight, higher-confidence, fewer dupes |

**Only codex caught** (highest-impact gap): the test is wired only in the generated
`project.pbxproj`, not in `project.yml` — coverage will vanish on the next `cc-xcgen`.

**Both agree on** (the durable signal — flag these first):
- Tests mutate `WindowManager.shared` singleton with no `setUp`/`tearDown`.
- Unit tests post the real `NSApplication.willTerminateNotification` process-wide.
- Tests hit the real persisted visibility store (filesystem side effects).
- `isTerminating` is needlessly `public`.
- `windowDidInteract(.close)` still fires unconditionally during termination.
- Unrelated `TEMP_*` pbxproj churn bundled into the commit.

**Only claude raised:** the Swift 6 `@MainActor`/actor-isolation cluster, the `object: nil`
spoofing/security angle, the mutation-testing gap, and the missing `removeObserver`.
