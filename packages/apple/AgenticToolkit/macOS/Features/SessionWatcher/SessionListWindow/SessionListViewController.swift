//
//  SessionsViewController.swift
//  AgenticToolkit
//
//  Created by Mike Fullerton on 4/29/26.
//

import AppKit
import AgenticToolkitCore

extension SessionWatcher {

    public class SessionListViewController: WindowContentViewController<SessionListView> {

        public let viewModel: SessionListViewModel

        public init(source: SessionListSource) {
            let viewModel = SessionListViewModel(
                source: source,
                settingsStore: UserSettings.shared
            )

            self.viewModel = viewModel
            super.init(contentView: SessionListView(viewModel: viewModel))
        }

        required init?(coder: NSCoder) {
            fatalError("init(coder:) has not been implemented")
        }

        public override func viewWillAppear() {
            super.viewWillAppear()
            viewModel.loadSessions()
        }
    }
}
