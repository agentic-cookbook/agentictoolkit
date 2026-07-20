import Foundation
import Testing
@testable import AgenticToolkitCore

@Suite("ArtificialAnalysisStore")
struct ArtificialAnalysisStoreTests {

    @Test("parse maps the documented v2 response to slug-keyed ranks")
    func parsesDocumentedShape() {
        let json = """
        {"status": 200,
         "data": [
           {"id": "2dad8957", "name": "o3-mini", "slug": "o3-mini",
            "evaluations": {"artificial_analysis_intelligence_index": 62.9,
                            "artificial_analysis_coding_index": 55.8,
                            "mmlu_pro": 0.791},
            "median_output_tokens_per_second": 153.831},
           {"name": "no slug — skipped"},
           {"slug": "bare-model"}
         ]}
        """
        let ranks = ArtificialAnalysisStore.parse(Data(json.utf8))
        #expect(ranks.count == 2)
        let mini = ranks["o3-mini"]
        #expect(mini?.name == "o3-mini")
        #expect(mini?.intelligenceIndex == 62.9)
        #expect(mini?.codingIndex == 55.8)
        #expect(mini?.outputTokensPerSecond == 153.831)
        let bare = ranks["bare-model"]
        #expect(bare?.name == "bare-model")
        #expect(bare?.intelligenceIndex == nil)
    }

    @Test("parse returns empty for malformed payloads")
    func parsesMalformed() {
        #expect(ArtificialAnalysisStore.parse(Data("not json".utf8)).isEmpty)
        #expect(ArtificialAnalysisStore.parse(Data("{\"data\": {}}".utf8)).isEmpty)
    }
}
