// The Narratives URL grammar — BOTH halves of the iframe hash mirror, owned here so the
// two hosts (the hub's /[slug]/narratives route, the narratives site's /home) and
// NarrativesFrame's own hash-strip can never drift apart:
//   inner path  = the outer route's catch-all segments joined with "/"
//   outer href  = <base>/<inner> (base alone when the inner app is at its root)

/** The iframe-inner narrative path carried by a host route's catch-all segments. */
export function narrativesInnerPath(segments?: string[]): string {
  return segments?.join("/") ?? "";
}

/** The outer URL a host mirrors the iframe's hash navigation into (history.replaceState). */
export function narrativesOuterHref(base: string, inner: string): string {
  return inner ? `${base}/${inner}` : base;
}
