import Foundation

/// The one place a locally-pulled model's prose description exists: its
/// ollama.com page. Neither the local server's `/api/show` nor the registry
/// manifests carry description text (verified against ollama 0.20.x), but every
/// published model — library and community namespaces alike — has a page whose
/// `og:description` meta tag holds the author's blurb. URL building and parsing
/// are pure for testability; every failure degrades to `nil` so callers fall
/// back to curated or cached text.
public enum OllamaModelPageStore {

    /// Everything a model's ollama.com page tells us: the author's blurb plus
    /// the page's LIVE popularity stats — download count ("117.4M") and last
    /// update ("1 year ago") — the only ranking signal that exists for
    /// community fine-tunes.
    public struct PageInfo: Sendable, Equatable {
        public let description: String?
        public let downloads: String?
        public let updated: String?
        public init(description: String?, downloads: String?, updated: String?) {
            self.description = description
            self.downloads = downloads
            self.updated = updated
        }
        public var isEmpty: Bool { description == nil && downloads == nil && updated == nil }
    }

    /// `https://ollama.com/library/<name>` for official models,
    /// `https://ollama.com/<user>/<name>` for community ones. The tag is
    /// dropped — all of a model's tags share one page and one description.
    public static func pageURL(for model: String) -> URL? {
        let name = String(model.prefix { $0 != ":" })
        guard !name.isEmpty, !name.hasPrefix("/"), !name.hasSuffix("/") else { return nil }
        let path = name.contains("/") ? name : "library/\(name)"
        guard let escaped = path.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) else {
            return nil
        }
        return URL(string: "https://ollama.com/\(escaped)")
    }

    /// The page's `og:description` (or plain `description`) meta content,
    /// entity-unescaped and trimmed; nil when neither is present or it's empty.
    public static func parseDescription(_ html: String) -> String? {
        let patterns = [
            "<meta[^>]*property=\"og:description\"[^>]*content=\"([^\"]*)\"",
            "<meta[^>]*content=\"([^\"]*)\"[^>]*property=\"og:description\"",
            "<meta[^>]*name=\"description\"[^>]*content=\"([^\"]*)\"",
            "<meta[^>]*content=\"([^\"]*)\"[^>]*name=\"description\""
        ]
        for pattern in patterns {
            guard let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]),
                  let match = regex.firstMatch(in: html, range: NSRange(html.startIndex..., in: html)),
                  let range = Range(match.range(at: 1), in: html) else { continue }
            let text = unescape(String(html[range])).trimmingCharacters(in: .whitespacesAndNewlines)
            if !text.isEmpty { return text }
        }
        return nil
    }

    /// The page's download count ("117.4M": a bare stat span followed by a
    /// "Downloads" span) and last-update age ("1 year ago": the span after an
    /// "Updated" span); either nil when the markup isn't found.
    public static func parseStats(_ html: String) -> (downloads: String?, updated: String?) {
        let downloads = firstCapture(
            "<span[^>]*>\\s*([0-9][0-9.,]*[KMB]?)\\s*</span>\\s*<span[^>]*>(?:&nbsp;|\\s)*Downloads",
            in: html)
        let updated = firstCapture(
            "Updated(?:&nbsp;|\\s)*</span>\\s*<span[^>]*>\\s*([^<]+?)\\s*</span>",
            in: html)
        return (downloads, updated)
    }

    /// `GET` the model's page once and parse everything it offers — blurb,
    /// downloads, updated; `nil` on any transport failure.
    public static func fetchInfo(model: String, timeout: TimeInterval = 8) async -> PageInfo? {
        guard let url = pageURL(for: model) else { return nil }
        var request = URLRequest(url: url, timeoutInterval: timeout)
        request.httpMethod = "GET"
        guard let (data, response) = try? await URLSession.shared.data(for: request),
              let http = response as? HTTPURLResponse, http.statusCode == 200,
              let html = String(data: data, encoding: .utf8) else { return nil }
        let stats = parseStats(html)
        return PageInfo(description: parseDescription(html),
                        downloads: stats.downloads, updated: stats.updated)
    }

    private static func firstCapture(_ pattern: String, in html: String) -> String? {
        guard let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]),
              let match = regex.firstMatch(in: html, range: NSRange(html.startIndex..., in: html)),
              let range = Range(match.range(at: 1), in: html) else { return nil }
        let text = String(html[range]).trimmingCharacters(in: .whitespacesAndNewlines)
        return text.isEmpty ? nil : text
    }

    /// Minimal entity decode for the handful HTML escapes in meta content.
    /// `&amp;` goes last so `&amp;lt;` decodes to `&lt;`, not `<`.
    private static func unescape(_ text: String) -> String {
        text.replacingOccurrences(of: "&lt;", with: "<")
            .replacingOccurrences(of: "&gt;", with: ">")
            .replacingOccurrences(of: "&quot;", with: "\"")
            .replacingOccurrences(of: "&#39;", with: "'")
            .replacingOccurrences(of: "&apos;", with: "'")
            .replacingOccurrences(of: "&amp;", with: "&")
    }
}
