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

    ]
)
