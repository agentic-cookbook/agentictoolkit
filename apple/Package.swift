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
    ],
    targets: [
        .target(
            name: "AgenticToolkit"
        ),
        .testTarget(
            name: "AgenticToolkitTests",
            dependencies: ["AgenticToolkit"]
        ),
    ]
)
