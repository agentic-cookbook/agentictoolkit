"use client";

import { NotebookFeature } from "./NotebookFeature";
import { DOCS_CORPUS } from "./corpus";

/**
 * The DOCS route: the owner's informal corpus — anything written down that is not a note and
 * not composed enough to be a paper — browsed through the same hierarchical category rail the
 * notebook and the research surface use.
 *
 * It is {@link NotebookFeature} bound to {@link DOCS_CORPUS} and nothing else, because today
 * the two shelves differ only in which marker the backend files a document under and in the
 * words on screen. What will make docs their own thing is v2, where a doc is also an UPLOADED
 * file of any type; a doc has a bucket and a marker table of its own (`content.docs`) precisely
 * so that file has somewhere to land. When the upload surface exists it will want a home of its
 * own, and moving this file out is the whole of that move.
 */
export function DocsFeature(props: Omit<Parameters<typeof NotebookFeature>[0], "corpus">) {
  return <NotebookFeature {...props} corpus={DOCS_CORPUS} />;
}
