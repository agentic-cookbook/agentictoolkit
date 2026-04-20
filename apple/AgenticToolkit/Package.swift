// swift-tools-version: 5.10
import PackageDescription

// SwiftPM wrapper exposing AgenticToolkit, AgenticAppKit, AgenticTerminalKit,
// and AgenticFileBrowser as library products. XcodeGen (project.yml) remains
// the canonical build for in-repo development and testing.
let package = Package(
    name: "AgenticToolkitPackages",
    platforms: [.macOS(.v14)],
    products: [
        .library(name: "AgenticToolkit", targets: ["AgenticToolkit"]),
        .library(name: "AgenticAppKit", targets: ["AgenticAppKit"]),
        .library(name: "AgenticTerminalKit", targets: ["AgenticTerminalKit"]),
        .library(name: "AgenticFileBrowser", targets: ["AgenticFileBrowser"])
    ],
    dependencies: [
        .package(url: "https://github.com/CodeEditApp/CodeEditSourceEditor.git", from: "0.15.2"),
        .package(url: "https://github.com/CodeEditApp/CodeEditLanguages.git", exact: "0.1.20"),
        .package(url: "https://github.com/migueldeicaza/SwiftTerm", from: "1.2.0")
    ],
    targets: [
        .target(
            name: "AgenticToolkit",
            path: "AgenticToolkit",
            exclude: ["Tests"]
        ),
        .target(
            name: "AgenticAppKit",
            dependencies: ["AgenticToolkit"],
            path: "AgenticAppKit",
            exclude: [
                "AI/Tests",
                "Log/Tests",
                "Scripting/Tests",
                "WindowManagement/Tests"
            ]
        ),
        .target(
            name: "AgenticTerminalKit",
            dependencies: [
                "AgenticToolkit",
                "AgenticAppKit",
                .product(name: "SwiftTerm", package: "SwiftTerm")
            ],
            path: "AgenticTerminalKit",
            exclude: ["Tests"]
        ),
        .target(
            name: "AgenticFileBrowser",
            dependencies: [
                "AgenticToolkit",
                .product(name: "CodeEditSourceEditor", package: "CodeEditSourceEditor"),
                .product(name: "CodeEditLanguages", package: "CodeEditLanguages")
            ],
            path: "AgenticFileBrowser",
            exclude: [
                "Tests",
                "Core/Tests",
                "Detection/Tests",
                "Git/Tests"
            ]
        )
    ]
)
