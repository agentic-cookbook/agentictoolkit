// @agentic-toolkit/notebook — the Notebook feature: a master/detail surface over the
// owner's notes, browsed through a hierarchical category rail. A note IS a markdown
// document (see @agentic-toolkit/data/notes), so the editor is the research surface's
// minus everything about publishing; the category TREE is what makes it its own feature.
// The entry mounts the deep-linked route (the host passes `basePath`).
export { NotebookFeature } from "./NotebookFeature";

// The notebook URL grammar, owned here so every host parses it identically.
// It lives at the SERVER-SAFE ./parse subpath ONLY — deliberately NOT re-exported here:
// this barrel's dist is a "use client" module, so an RSC page that imported the parse
// helper from it would throw in prod (render-only client refs).

// The pane without the URL wiring, for a host that wants the notebook embedded in a
// surface it already routes (the way the hub embeds ResearchPane in its topic rail).
export { NotebookPane } from "./NotebookPane";

// The same surface over the owner's DOCS shelf, and the corpus descriptor that binds it —
// exported so a host can mount a third shelf without this package having to know about it.
export { DocsFeature } from "./DocsFeature";
export { NOTES_CORPUS, DOCS_CORPUS, type NotebookCorpus, type CorpusNoun } from "./corpus";
