//
//  SessionWatcherSummarizerDebugWindowController 2.swift
//  AgenticToolkit
//
//  Created by Mike Fullerton on 4/29/26.
//

import AppKit

extension SessionWatcher {

    /// AppKit window controller for the debug log.
    @MainActor
    public final class SummarizerDebugWindowController:
        WindowController<WindowContentViewController<SummarizerDebugView>> {

        public static let windowID = "summarizerDebug"

        public init() {
            super.init(
                windowID: Self.windowID,
                contentViewController: WindowContentViewController<SummarizerDebugView>()
            )

            self.windowSpec = WindowSpec(
                defaultSize: NSSize(width: 700, height: 500),
                minSize: NSSize(width: 400, height: 300),
                defaultPosition: .center,
                persistsFrame: true
            )
            self.windowTitle = "Summarizer Debug Log"
            self.windowStyleMask = [.titled, .closable, .resizable, .miniaturizable]
        }
    }
}
