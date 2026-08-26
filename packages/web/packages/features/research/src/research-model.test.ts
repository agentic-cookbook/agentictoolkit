// `routeFromTitle` — the title-to-slug rule the identity field follows as you type.
//
// It is NOT `@agenticdevelopertoolkit/ui/lib/slug`'s `slugify`, and the difference is the point: that
// one slugs USER HANDLES (max 40 chars, no underscore, SLUG_REGEX). This one must produce a
// PUBLIC_ROUTE_RE value — 2–128 chars, underscores allowed — so a long paper title keeps its
// tail instead of being truncated mid-word at 40.
import { describe, it, expect } from "vitest";
import { PUBLIC_ROUTE_RE, routeFromTitle } from "./research-model";

describe("routeFromTitle", () => {
  it("lowercases and joins words with dashes", () => {
    expect(routeFromTitle("Intelligence At The Edges")).toBe("intelligence-at-the-edges");
  });

  it("drops punctuation rather than transliterating it", () => {
    expect(routeFromTitle("What's *next*, really?")).toBe("what-s-next-really");
  });

  it("trims the dashes a leading or trailing symbol would leave", () => {
    expect(routeFromTitle("  — Hello —  ")).toBe("hello");
  });

  it("collapses runs of separators", () => {
    expect(routeFromTitle("a   ---   b")).toBe("a-b");
  });

  it("keeps a long title whole up to the route limit", () => {
    const long = routeFromTitle("word ".repeat(60));
    expect(long.length).toBeLessThanOrEqual(128);
    expect(PUBLIC_ROUTE_RE.test(long)).toBe(true);
  });

  it("never ends on the dash a truncation would leave", () => {
    expect(routeFromTitle("x".repeat(127) + " tail")).not.toMatch(/-$/);
  });

  it("is empty when there is nothing sluggable — the caller decides what to do", () => {
    expect(routeFromTitle("!!!")).toBe("");
    expect(routeFromTitle("")).toBe("");
  });

  it("is empty rather than invalid for a one-character title", () => {
    // PUBLIC_ROUTE_RE demands at least 2 characters; emitting "a" would be a slug the API
    // rejects, which is worse than none.
    expect(routeFromTitle("A")).toBe("");
  });

  it("produces a value the route regex accepts for anything it does produce", () => {
    for (const t of ["Hello World", "A B", "2026 Notes", "Ünïcödé Title"]) {
      const r = routeFromTitle(t);
      if (r) expect(PUBLIC_ROUTE_RE.test(r)).toBe(true);
    }
  });
});
