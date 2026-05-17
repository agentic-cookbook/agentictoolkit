//
//  SettingsPanelDescriptor.swift
//  AgenticToolkit
//
//  Created by Mike Fullerton on 4/29/26.
//

import AppKit
import Combine

extension ComposableSettings {

    public class SettingsPanelDescriptor: ObservableObject {

        @Published public var title: String
        @Published public var icon: NSImage?
        @Published public var isDisabled: Bool = false

        @Published public var section: String?

        public init(title: String, icon: NSImage? = nil, isDisabled: Bool = false, section: String? = nil) {
            self.title = title
            self.icon = icon
            self.isDisabled = isDisabled
        }

        public convenience init() {
            self.init(title: "")
        }
    }
}
