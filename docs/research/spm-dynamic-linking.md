# SPM dynamic linking for host + NSBundle plugins

Reference note on why `apple/AgenticToolkit/Package.swift` ships an
asymmetric product list — 13 per-target automatic `.library` products plus
one `.dynamic` umbrella named `AgenticToolkitPluginHost`. The shape is a
deliberate workaround for a known SPM limitation; this note captures the
research so anyone asking "why?" has an answer.

---

## The problem

SPM library products default to **automatic** linkage. When consumed by
Xcode, "automatic" is resolved per build graph — usually as a static
archive. For most apps this is fine: every module is linked exactly once
into the final binary.

It breaks when one process loads another binary that also statically
links the same SPM modules. Our topology:

- **Host app** (`AgenticToolkitApp`) statically links `AgenticToolkitCore`,
  `AgenticToolkitAIPlugins`, etc.
- **Plugin bundles** (`ClaudeAPIPlugin.aiplugin`, `OpenAIPlugin.aiplugin`, …) in
  `~/.agenticplugins/` each statically link the same modules and are
  loaded into the host at runtime via `Bundle.load()`.

With both ends statically linked:

- Each plugin ships its own copy of every shared Swift type.
- Cross-boundary `is`/`as?` checks fail — `ChatMessage` in the plugin is
  a different type than `ChatMessage` in the host, even with identical
  definitions.
- Singletons duplicate: the plugin's `PluginManager.shared` is a
  different instance from the host's.
- Logger subsystems, notifications, and any `@objc` runtime
  registrations all double up.

The fix is for the shared modules to be loaded exactly once — i.e. they
live in a **dynamic framework** that both host and plugin link against,
without either end embedding a private copy.

## Why it's not solved out of the box

Xcode 11.4.1 added a partial auto-fix: when an app and an embedded
`.appex` extension both link the same SPM product, Xcode auto-promotes
that product to dynamic and de-duplicates the framework in
`Contents/Frameworks/`. It works and requires no manual configuration.

The catch: **it only fires for app + embedded extension.** NSBundle
plugins (`type: bundle`, loaded at runtime, not an `.appex`) are not part
of Xcode's implicit dependency graph at build time, so the promotion
doesn't trigger. SPM maintainers have acknowledged this on the Swift
Forums — the automation is narrow, and NSBundle-plugin topologies are
expected to express dynamic linkage themselves.

There is **no Xcode build-setting override** for SPM linkage decisions.
`MACH_O_TYPE = mh_dylib` on a consumer target has no effect on an SPM
product's linkage — the decision must be expressed in `Package.swift`.

## Why the naive `type: .dynamic` fails

Flipping an existing product's `type:` to `.dynamic` produces, for every
target consumed statically elsewhere in the build graph:

> Swift package target 'AgenticToolkitCore' is linked as a static library
> by 'AgenticToolkitAIPluginsCore' and 2 other targets, but cannot be
> built dynamically because there is a package product with the same
> name.

The trigger is **a `.dynamic` product sharing its name with a target**.
SPM disambiguates product-vs-target references by name, and a consumer
linking the target statically can't coexist with another consumer linking
the same-named product dynamically. This has been reproduced independently
(see Realm issue #8694, linked below).

## The Apple-documented fix

Apple's own `LibraryProduct.Kind` doc shows the pattern: pair an automatic
product and a `.dynamic` product on the same target(s) **with distinct
names**. A minimal example, paraphrased:

```swift
.library(name: "MyLibrary", targets: ["MyLibrary"]),                         // automatic
.library(name: "MyDynamicLibrary", type: .dynamic, targets: ["MyLibrary"]),  // dynamic, distinct name
```

Consumers pick whichever product fits — statically-linked consumers
reference the automatic product, dynamically-linked consumers reference
the `.dynamic` product, and SPM does not conflate them because the names
differ.

## What this project does

Rather than pair every target with its own `*Dynamic` variant (which
would double the product list for a concern that only six modules
actually have), we add **one** dynamic umbrella:

```swift
.library(
    name: "AgenticToolkitPluginHost",
    type: .dynamic,
    targets: [
        "AgenticToolkitCore",
        "AgenticToolkitScripting",
        "AgenticToolkitCoreUI",
        "AgenticToolkitSettingsWindow",
        "AgenticToolkitChatWindow",
        "AgenticToolkitAIPlugins",
    ]
),
```

Wiring:

- `AgenticToolkitApp` **embeds** `AgenticToolkitPluginHost` (`embed: true,
  link: true` in `apple/AgenticToolkitApp/project.yml`). The framework
  lands in `AgenticToolkitApp.app/Contents/Frameworks/`.
- Plugin bundles **link without embedding** (`embed: false, link: true`
  in `apple/AIPlugins/project.yml`). At load time, the plugin's `@rpath`
  (configured via `LD_RUNPATH_SEARCH_PATHS = @loader_path/../../../../Frameworks`)
  resolves `AgenticToolkitPluginHost.framework` to the copy in the host's
  `Contents/Frameworks/`.
- Both ends resolve the bundled Swift types to the same loaded image —
  `ChatMessage`, `PluginManager`, logger subsystems, and singleton
  instances are all unique across the process.

The 7 non-boundary modules (`AIProvider`, `LoggingWindow`, `NotesWindow`,
`TerminalWindow`, `FileBrowser`, `Document`, `All`) stay as automatic
products only — they don't cross the plugin boundary, so paying the
dynamic-framework cost would be noise.

### Trade-offs, explicit

**Asymmetric product list.** A reader of `Package.swift` sees 13
per-target products and one umbrella, and has to understand the split.
That's the cost of the workaround. The alternative — pairing every target
with a `*Dynamic` variant — keeps the list uniform but doubles it and
signals "both linkage modes are expected for every module," which isn't
true. Asymmetric is the more honest shape.

**Boundary list in `Package.swift`.** Adding a module to the host/plugin
boundary now means editing the `AgenticToolkitPluginHost` `targets:`
list. That's one extra step vs. just adding another per-target product,
but the list is short enough to keep legible.

**Plugin churn.** Every plugin now depends on one package product
(`AgenticToolkitPluginHost`) instead of enumerating six. Plugin sources
import the specific modules they need — `import AgenticToolkitCore`,
`import AgenticToolkitAIPlugins`, etc. — and the umbrella provides them.

## When to revisit

- **Xcode expands auto-promotion to NSBundle plugins.** Drop the umbrella
  and let the build graph resolve linkage. Track the Swift Forums
  threads linked below.
- **SPM gains a product-agnostic linkage override.** A build-setting or
  manifest-level "link this package as dynamic for this consumer" would
  let us remove the separate umbrella product entirely.
- **We add a new module to the boundary.** Edit the umbrella's
  `targets:` list; that's the only place.
- **We remove the NSBundle plugin architecture entirely** (e.g. move
  plugins to XPC services or separate processes). Then the whole
  workaround goes away — dynamic linking is only needed because plugins
  share a process with the host.

## Sources

- [LibraryProduct.Kind — Swift Package Manager (Apple)](https://github.com/apple/swift-package-manager/blob/main/Sources/Runtimes/PackagePlugin/Documentation.docc/Curation/LibraryProduct_Kind.md)
  — `.automatic`, `.dynamic`, `.static` enum; the canonical example pairs
  automatic + dynamic with distinct names.
- [Swift Forums — Swift Packages in multiple targets results in "duplication of library code" errors](https://forums.swift.org/t/swift-packages-in-multiple-targets-results-in-this-will-result-in-duplication-of-library-code-errors/34892)
  — dynamic-framework-per-shared-module is described as "the right
  workaround"; automation for NSBundle-plugin topologies is called out
  as not covered.
- [Swift Forums — How to link a Swift Package as dynamic](https://forums.swift.org/t/how-to-link-a-swift-package-as-dynamic/32062)
  — confirms no Xcode-side override for SPM linkage.
- [Realm issue #8694](https://github.com/realm/realm-swift/issues/8694)
  — independent repro of the "cannot be built dynamically because there
  is a package product with the same name" error when a `.dynamic`
  product shares its name with a target.
- [Swift-Package-Manager-Static-Dynamic-Xcode-Bug (renaudjenny)](https://github.com/renaudjenny/Swift-Package-Manager-Static-Dynamic-Xcode-Bug)
  — third-party repro of the same issue and a wrapper-framework
  workaround.
