// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "AgenticToolkit",
    platforms: [
        .macOS(.v14),
    ],
    products: [
        .library(name: "AgenticToolkitCore", targets: ["AgenticToolkitCore"]),
        .library(name: "AgenticToolkitScripting", targets: ["AgenticToolkitScripting"]),
        .library(name: "AgenticToolkitCoreUI", targets: ["AgenticToolkitCoreUI"]),
        .library(name: "AgenticToolkitAIProvider", targets: ["AgenticToolkitAIProvider"]),
        .library(name: "AgenticToolkitChatWindow", targets: ["AgenticToolkitChatWindow"]),
        .library(name: "AgenticToolkitLoggingWindow", targets: ["AgenticToolkitLoggingWindow"]),
        .library(name: "AgenticToolkitNotesWindow", targets: ["AgenticToolkitNotesWindow"]),
        .library(name: "AgenticToolkitSettingsWindow", targets: ["AgenticToolkitSettingsWindow"]),
        .library(name: "AgenticToolkitTerminalWindow", targets: ["AgenticToolkitTerminalWindow"]),
        .library(name: "AgenticToolkitFileBrowser", targets: ["AgenticToolkitFileBrowser"]),
        .library(name: "AgenticToolkitAIPlugins", targets: ["AgenticToolkitAIPlugins"]),
        .library(name: "AgenticToolkitDocument", targets: ["AgenticToolkitDocument"]),
        .library(name: "AgenticToolkitAll", targets: ["AgenticToolkitAll"]),

        // Dynamic umbrella. Bundles the modules that cross the host/plugin
        // boundary so the host app and NSBundle plugin bundles resolve to
        // the same loaded image at runtime (avoids duplicate class
        // registrations, singleton duplication, and type-identity mismatches
        // that static-linking both ends produces).
        //
        // Name is intentionally distinct from every target and every other
        // product — sharing a name with a target triggers SPM's
        // "cannot be built dynamically because there is a package product
        // with the same name" error.
        //
        // See docs/research/spm-dynamic-linking.md for the full rationale.
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
    ],
    dependencies: [
        .package(url: "https://github.com/migueldeicaza/SwiftTerm", from: "1.2.0"),
        .package(url: "https://github.com/CodeEditApp/CodeEditSourceEditor.git", from: "0.15.2"),
        .package(url: "https://github.com/CodeEditApp/CodeEditLanguages.git", exact: "0.1.20"),
    ],
    targets: [
        .target(name: "AgenticToolkitCore"),
        .testTarget(
            name: "AgenticToolkitCoreTests",
            dependencies: ["AgenticToolkitCore"]
        ),

        .target(
            name: "AgenticToolkitScripting",
            dependencies: ["AgenticToolkitCore"]
        ),
        .testTarget(
            name: "AgenticToolkitScriptingTests",
            dependencies: ["AgenticToolkitScripting", "AgenticToolkitCore"]
        ),

        .target(
            name: "AgenticToolkitCoreUI",
            dependencies: ["AgenticToolkitCore", "AgenticToolkitScripting"]
        ),
        .testTarget(
            name: "AgenticToolkitCoreUITests",
            dependencies: ["AgenticToolkitCoreUI", "AgenticToolkitScripting", "AgenticToolkitCore"]
        ),

        .target(
            name: "AgenticToolkitAIProvider",
            dependencies: ["AgenticToolkitCore"]
        ),
        .testTarget(
            name: "AgenticToolkitAIProviderTests",
            dependencies: ["AgenticToolkitAIProvider", "AgenticToolkitCore"]
        ),

        .target(
            name: "AgenticToolkitChatWindow",
            dependencies: ["AgenticToolkitCore", "AgenticToolkitCoreUI"]
        ),

        .target(
            name: "AgenticToolkitLoggingWindow",
            dependencies: ["AgenticToolkitCore", "AgenticToolkitCoreUI"]
        ),
        .testTarget(
            name: "AgenticToolkitLoggingWindowTests",
            dependencies: ["AgenticToolkitLoggingWindow", "AgenticToolkitCoreUI", "AgenticToolkitCore"]
        ),

        .target(
            name: "AgenticToolkitNotesWindow",
            dependencies: ["AgenticToolkitCore", "AgenticToolkitCoreUI"]
        ),

        .target(
            name: "AgenticToolkitSettingsWindow",
            dependencies: ["AgenticToolkitCore", "AgenticToolkitCoreUI"]
        ),

        .target(
            name: "AgenticToolkitTerminalWindow",
            dependencies: [
                "AgenticToolkitCore",
                "AgenticToolkitCoreUI",
                "AgenticToolkitAIProvider",
                .product(name: "SwiftTerm", package: "SwiftTerm"),
            ]
        ),
        .testTarget(
            name: "AgenticToolkitTerminalWindowTests",
            dependencies: [
                "AgenticToolkitTerminalWindow",
                "AgenticToolkitAIProvider",
                "AgenticToolkitCoreUI",
                "AgenticToolkitCore",
            ]
        ),

        .target(
            name: "AgenticToolkitFileBrowser",
            dependencies: [
                "AgenticToolkitCore",
                .product(name: "CodeEditSourceEditor", package: "CodeEditSourceEditor"),
                .product(name: "CodeEditLanguages", package: "CodeEditLanguages"),
            ]
        ),
        .testTarget(
            name: "AgenticToolkitFileBrowserTests",
            dependencies: ["AgenticToolkitFileBrowser", "AgenticToolkitCore"]
        ),

        .target(
            name: "AgenticToolkitAIPlugins",
            dependencies: [
                "AgenticToolkitCore",
                "AgenticToolkitCoreUI",
                "AgenticToolkitSettingsWindow",
                "AgenticToolkitChatWindow",
            ]
        ),
        .testTarget(
            name: "AgenticToolkitAIPluginsTests",
            dependencies: ["AgenticToolkitAIPlugins"]
        ),

        .target(
            name: "AgenticToolkitDocument",
            dependencies: [
                "AgenticToolkitCore",
                "AgenticToolkitFileBrowser",
                "AgenticToolkitTerminalWindow",
            ]
        ),
        .testTarget(
            name: "AgenticToolkitDocumentTests",
            dependencies: ["AgenticToolkitDocument"]
        ),

        .target(
            name: "AgenticToolkitAll",
            dependencies: [
                "AgenticToolkitCore",
                "AgenticToolkitScripting",
                "AgenticToolkitCoreUI",
                "AgenticToolkitAIProvider",
                "AgenticToolkitChatWindow",
                "AgenticToolkitLoggingWindow",
                "AgenticToolkitNotesWindow",
                "AgenticToolkitSettingsWindow",
                "AgenticToolkitTerminalWindow",
                "AgenticToolkitFileBrowser",
                "AgenticToolkitAIPlugins",
                "AgenticToolkitDocument",
            ],
            path: "Sources/AgenticToolkitAll"
        ),
    ]
)
