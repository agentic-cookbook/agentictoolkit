import AppKit

/// Animated typing indicator with three pulsing dots.
@MainActor
public final class TypingIndicatorView: NSView {
    private let dots: [NSView] = (0..<3).map { _ in
        let dot = NSView()
        dot.wantsLayer = true
        dot.layer?.cornerRadius = 3.5
        dot.layer?.backgroundColor = NSColor.secondaryLabelColor.cgColor
        dot.translatesAutoresizingMaskIntoConstraints = false
        return dot
    }
    private var timer: Timer?
    private var step: Int = 0

    public override init(frame: NSRect) {
        super.init(frame: frame)
        setup()
    }

    @available(*, unavailable)
    public required init?(coder: NSCoder) { fatalError() }

    private func setup() {
        wantsLayer = true
        layer?.cornerRadius = 12
        layer?.backgroundColor = NSColor.secondaryLabelColor.withAlphaComponent(0.08).cgColor
        translatesAutoresizingMaskIntoConstraints = false

        let stack = NSStackView(views: dots)
        stack.orientation = .horizontal
        stack.spacing = 4
        stack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stack)

        NSLayoutConstraint.activate([
            stack.centerXAnchor.constraint(equalTo: centerXAnchor),
            stack.centerYAnchor.constraint(equalTo: centerYAnchor),
            widthAnchor.constraint(equalToConstant: 48),
            heightAnchor.constraint(equalToConstant: 28)
        ])
        for dot in dots {
            NSLayoutConstraint.activate([
                dot.widthAnchor.constraint(equalToConstant: 7),
                dot.heightAnchor.constraint(equalToConstant: 7)
            ])
        }
    }

    public func startAnimating() {
        for dot in dots { dot.alphaValue = 0.3 }
        step = 0
        timer = Timer.scheduledTimer(withTimeInterval: 0.35, repeats: true) { [weak self] _ in
            MainActor.assumeIsolated {
                self?.tick()
            }
        }
    }

    private func tick() {
        let active = step % 3
        for (index, dot) in dots.enumerated() {
            NSAnimationContext.runAnimationGroup { ctx in
                ctx.duration = 0.2
                dot.animator().alphaValue = (index == active) ? 1.0 : 0.3
            }
        }
        step += 1
    }

    public override func removeFromSuperview() {
        timer?.invalidate()
        timer = nil
        super.removeFromSuperview()
    }
}
