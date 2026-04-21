// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "AgenticToolkitTerminalWindow",
    platforms: [
        .macOS(.v14),
    ],
    products: [
        .library(
            name: "AgenticToolkitTerminalWindow",
            type: .dynamic,
            targets: ["AgenticToolkitTerminalWindow"]
        ),
    ],
    dependencies: [
        .package(url: "https://github.com/migueldeicaza/SwiftTerm", from: "1.2.0"),
        .package(path: "../AgenticToolkitCore"),
        .package(path: "../AgenticToolkitCoreUI"),
        .package(path: "../AgenticToolkitAIProvider"),
    ],
    targets: [
        .target(
            name: "AgenticToolkitTerminalWindow",
            dependencies: [
                .product(name: "AgenticToolkitCore", package: "AgenticToolkitCore"),
                .product(name: "AgenticToolkitCoreUI", package: "AgenticToolkitCoreUI"),
                .product(name: "AgenticToolkitAIProvider", package: "AgenticToolkitAIProvider"),
                .product(name: "SwiftTerm", package: "SwiftTerm"),
            ],
            path: "Source"
        ),
        .testTarget(
            name: "AgenticToolkitTerminalWindowTests",
            dependencies: [
                "AgenticToolkitTerminalWindow",
                .product(name: "AgenticToolkitAIProvider", package: "AgenticToolkitAIProvider"),
                .product(name: "AgenticToolkitCoreUI", package: "AgenticToolkitCoreUI"),
                .product(name: "AgenticToolkitCore", package: "AgenticToolkitCore"),
            ],
            path: "Tests"
        ),
    ]
)
