// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "AgenticToolkitCore",
    platforms: [
        .macOS(.v14),
    ],
    products: [
        .library(
            name: "AgenticToolkitCore",
            type: .dynamic,
            targets: ["AgenticToolkitCore"]
        ),
    ],
    dependencies: [

    ],
    targets: [
        .target(
            name: "AgenticToolkitCore",
            dependencies: [

            ],
            path: "Source"
        ),
        .testTarget(
            name: "AgenticToolkitCoreTests",
            dependencies: [
                "AgenticToolkitCore",
            ],
            path: "Tests"
        ),
    ]
)
