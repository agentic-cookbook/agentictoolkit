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
