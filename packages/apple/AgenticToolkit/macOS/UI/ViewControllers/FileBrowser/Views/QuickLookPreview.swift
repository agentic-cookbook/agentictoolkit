import QuickLookUI
import SwiftUI

/// Finder's own preview, for the files the source editor can't take: images,
/// PDFs, movies, audio, archives, Keynote decks.
///
/// Leaning on QuickLook rather than a stack of per-type views is what keeps
/// "show it if we can" from becoming a format list this repo has to maintain,
/// and it is the same renderer the user already knows from the Finder
/// (`native-controls`). A type QuickLook has no generator for draws its own
/// "no preview available" — that is the honest answer, and it costs nothing.
struct QuickLookPreview: NSViewRepresentable {

    /// The file to preview.
    let url: URL

    func makeNSView(context: Context) -> QLPreviewView {
        // The failable initializer is the only one that takes a style; it
        // returns nil only when QuickLook is unavailable, and the plain
        // initializer is the same view at the default style.
        let view = QLPreviewView(frame: .zero, style: .normal) ?? QLPreviewView()
        view.autostarts = true
        view.previewItem = url as NSURL
        return view
    }

    func updateNSView(_ view: QLPreviewView, context: Context) {
        // Reassigning the same item restarts the generator and flickers, so
        // only a genuine change is pushed through.
        guard (view.previewItem as? NSURL) as URL? != url else { return }
        view.previewItem = url as NSURL
    }

    /// QuickLook holds a generator process alive per view; closing releases it
    /// rather than waiting for the view to be collected.
    static func dismantleNSView(_ view: QLPreviewView, coordinator: ()) {
        view.close()
    }
}
