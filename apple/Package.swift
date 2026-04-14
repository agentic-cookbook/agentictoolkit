// swift-tools-version: 6.0

import PackageDescription

let package = Package(
    name: "AgenticToolkit",
    platforms: [
        .macOS(.v14),
        .iOS(.v17),
        .tvOS(.v17),
        .watchOS(.v10),
    ],
    products: [
        .library(
            name: "AgenticToolkit",
            targets: ["AgenticToolkit"]
        ),
        .library(
            name: "AgenticAppKit",
            targets: ["AgenticAppKit"]
        ),
        .library(
            name: "AgenticUIKit",
            targets: ["AgenticUIKit"]
        ),
        .library(
            name: "AgenticPluginSDK",
            targets: ["AgenticPluginSDK"]
        ),
        .library(
            name: "AgenticBuiltInPlugins",
            targets: ["AgenticBuiltInPlugins"]
        ),
        .library(
            name: "AgenticUI",
            targets: ["AgenticUI"]
        ),
    ],
    targets: [
        // Cross-platform (Foundation only)
        .target(
            name: "AgenticToolkit"
        ),
        .testTarget(
            name: "AgenticToolkitTests",
            dependencies: ["AgenticToolkit"]
        ),

        // macOS — AppKit
        .target(
            name: "AgenticAppKit",
            dependencies: ["AgenticToolkit"]
        ),
        .testTarget(
            name: "AgenticAppKitTests",
            dependencies: ["AgenticAppKit"]
        ),

        // iOS / tvOS — UIKit
        .target(
            name: "AgenticUIKit",
            dependencies: ["AgenticToolkit"]
        ),
        .testTarget(
            name: "AgenticUIKitTests",
            dependencies: ["AgenticUIKit"]
        ),

        // macOS — Plugin SDK & Plugins
        .target(
            name: "AgenticPluginSDK"
        ),
        .testTarget(
            name: "AgenticPluginSDKTests",
            dependencies: ["AgenticPluginSDK"]
        ),
        .target(
            name: "AgenticBuiltInPlugins",
            dependencies: ["AgenticPluginSDK"]
        ),
        .testTarget(
            name: "AgenticBuiltInPluginsTests",
            dependencies: ["AgenticBuiltInPlugins", "AgenticPluginSDK"]
        ),
        .target(
            name: "AgenticUI",
            dependencies: ["AgenticPluginSDK"]
        ),
        .testTarget(
            name: "AgenticUITests",
            dependencies: ["AgenticUI", "AgenticPluginSDK"]
        ),
    ]
)
