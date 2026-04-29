//
//  WindowController.swift
//  AgenticToolkit
//
//  Created by Mike Fullerton on 4/29/26.
//

import AppKit

open class WindowController<ViewControllerType: NSViewController>: SingleWindowController {
    public var viewController: ViewControllerType? { contentViewController as? ViewControllerType }
}

open class WindowContentViewController<ViewType: NSView>: NSViewController {
    public let contentView: ViewType
    
    public init(contentView: ViewType) {
        self.contentView = contentView
        super.init(nibName: nil, bundle: nil)
    }
    
    convenience public init() {
        self.init(contentView: ViewType())
    }
    
    public required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    public override func loadView() {
        self.view = contentView
    }
}
