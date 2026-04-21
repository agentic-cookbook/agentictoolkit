// swift-tools-version: 6.0
import PackageDescription

// Single dynamic library product (`AgenticToolkit`) bundling all targets.
// Individual targets remain so source stays modular and per-target test
// dependencies stay tight, but the runtime artifact is one framework. This
// sidesteps Xcode-SPM's "linked as a static library by X, but cannot be
// built dynamically because there is a package product with the same name"
// error that arises when multiple dynamic products share a package.
//
// Consumers import target-level modules (`import Core`, `import CoreUI`,
// etc.) and link a single `AgenticToolkit.framework`. Plugin bundles load
// the same framework image the app loaded — type identity across the
// plugin boundary is preserved.
let package = Package(
    name: "AgenticToolkit",
    platforms: [
        .macOS(.v14),
    ],
    products: [
        .library(
            name: "AgenticToolkit",
            type: .dynamic,
            targets: [
                "Core",
                "Scripting",
                "CoreUI",
                "AIProvider",
                "LoggingWindow",
                "ChatWindow",
                "NotesWindow",
                "SettingsWindow",
                "TerminalWindow",
                "FileBrowser",
                "AgenticPluginSDK",
            ]
        ),
    ],
    dependencies: [
        .package(url: "https://github.com/migueldeicaza/SwiftTerm", from: "1.2.0"),
        .package(url: "https://github.com/CodeEditApp/CodeEditSourceEditor.git", from: "0.15.2"),
        .package(url: "https://github.com/CodeEditApp/CodeEditLanguages.git", exact: "0.1.20"),
    ],
    targets: [
        .target(name: "Core",
                path: "Core"),
        .target(name: "Scripting",
                dependencies: ["Core"],
                path: "Scripting"),
        .target(name: "CoreUI",
                dependencies: ["Core", "Scripting"],
                path: "CoreUI"),
        .target(name: "AIProvider",
                dependencies: ["Core"],
                path: "AIProvider"),
        .target(name: "LoggingWindow",
                dependencies: ["Core", "CoreUI"],
                path: "LoggingWindow"),
        .target(name: "ChatWindow",
                dependencies: ["Core", "CoreUI"],
                path: "ChatWindow"),
        .target(name: "NotesWindow",
                dependencies: ["Core", "CoreUI"],
                path: "NotesWindow"),
        .target(name: "SettingsWindow",
                dependencies: ["Core", "CoreUI"],
                path: "SettingsWindow"),
        .target(name: "TerminalWindow",
                dependencies: [
                    "Core",
                    "CoreUI",
                    "AIProvider",
                    .product(name: "SwiftTerm", package: "SwiftTerm"),
                ],
                path: "TerminalWindow"),
        .target(name: "FileBrowser",
                dependencies: [
                    "Core",
                    .product(name: "CodeEditSourceEditor", package: "CodeEditSourceEditor"),
                    .product(name: "CodeEditLanguages", package: "CodeEditLanguages"),
                ],
                path: "FileBrowser"),
        .target(name: "AgenticPluginSDK",
                dependencies: ["Core", "CoreUI", "SettingsWindow", "ChatWindow"],
                path: "PluginsSDK"),

        // Test targets — sources live at the SPM default path Tests/<Name>/.
        .testTarget(name: "CoreTests",
                    dependencies: ["Core"]),
        .testTarget(name: "ScriptingTests",
                    dependencies: ["Scripting", "Core"]),
        .testTarget(name: "CoreUITests",
                    dependencies: ["CoreUI", "Scripting", "Core"]),
        .testTarget(name: "AIProviderTests",
                    dependencies: ["AIProvider", "Core"]),
        .testTarget(name: "LoggingWindowTests",
                    dependencies: ["LoggingWindow", "CoreUI", "Core"]),
        .testTarget(name: "TerminalWindowTests",
                    dependencies: ["TerminalWindow", "AIProvider", "CoreUI", "Core"]),
        .testTarget(name: "FileBrowserTests",
                    dependencies: ["FileBrowser", "Core"]),
        .testTarget(name: "AgenticPluginSDKTests",
                    dependencies: ["AgenticPluginSDK", "Core"]),
    ]
)
