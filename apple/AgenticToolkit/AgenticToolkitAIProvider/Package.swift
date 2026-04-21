// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "AgenticToolkitAIProvider",
    platforms: [
        .macOS(.v14),
    ],
    products: [
        .library(
            name: "AgenticToolkitAIProvider",
            type: .dynamic,
            targets: ["AgenticToolkitAIProvider"]
        ),
    ],
    dependencies: [
        .package(path: "../AgenticToolkitCore"),
    ],
    targets: [
        .target(
            name: "AgenticToolkitAIProvider",
            dependencies: [
                .product(name: "AgenticToolkitCore", package: "AgenticToolkitCore"),
            ],
            path: "Source"
        ),
        .testTarget(
            name: "AgenticToolkitAIProviderTests",
            dependencies: [
                "AgenticToolkitAIProvider",
                .product(name: "AgenticToolkitCore", package: "AgenticToolkitCore"),
            ],
            path: "Tests"
        ),
    ]
)
