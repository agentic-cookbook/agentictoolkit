// @vitest-environment jsdom
//
// PublishSection's published branch — the author's two affordances on a live paper: copy the
// URL, and go look at it. The Preview control is asserted as a LINK with a real href, because
// that is the whole point of the change: a click handler calling window.open() would satisfy
// "opens in a new tab" while being popup-blockable, un-middle-clickable, and announced as a
// button. `rel` is asserted alongside `target` — a `target="_blank"` without `noopener` hands
// the opened page a handle on this one.
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { PublishSection } from "./PublishSection";
import type { ResearchDocument } from "@agentic-toolkit/data/markdown";

vi.mock("@agentic-toolkit/data/markdown", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  markdownApi: { publish: vi.fn(), unpublish: vi.fn() },
}));

const DOC = {
  id: "doc-1",
  title: "Intelligence at the Edges",
  visibility: "public",
  publicRoute: "intelligence-at-the-edges",
} as unknown as ResearchDocument;

afterEach(cleanup);

describe("PublishSection — published", () => {
  it("offers a Preview link to the public URL, in a new tab", () => {
    render(
      <PublishSection
        doc={DOC}
        route="intelligence-at-the-edges"
        userSlug="mikefullerton"
        workspaceSlug="mikefullerton"
        onChanged={async () => {}}
      />,
    );
    const link = screen.getByRole("link", { name: /preview/i });
    expect(link).toHaveAttribute(
      "href",
      "https://agenticdeveloperresearch.com/mikefullerton/intelligence-at-the-edges",
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  it("offers no Preview link before the author has a slug — there is nowhere to go", () => {
    render(
      <PublishSection
        doc={DOC}
        route="intelligence-at-the-edges"
        userSlug=""
        workspaceSlug="mikefullerton"
        onChanged={async () => {}}
      />,
    );
    expect(screen.queryByRole("link", { name: /preview/i })).toBeNull();
    // The Copy button stays put (disabled), so the row doesn't restructure.
    expect(screen.getByRole("button", { name: /copy/i })).toBeDisabled();
  });
});
