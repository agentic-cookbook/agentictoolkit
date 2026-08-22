// @vitest-environment jsdom
//
// PublishSection's published branch — the author's two affordances on a live paper: copy the
// URL, and go look at it. The Preview control is asserted as a LINK with a real href, because
// that is the whole point of the change: a click handler calling window.open() would satisfy
// "opens in a new tab" while being popup-blockable, un-middle-clickable, and announced as a
// button. `rel` is asserted alongside `target` — a `target="_blank"` without `noopener` hands
// the opened page a handle on this one.
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { PublishSection } from "./PublishSection";
import type { ResearchDocument } from "@agentic-toolkit/data/markdown";

const { publish: publishMock } = vi.hoisted(() => ({ publish: vi.fn() }));
vi.mock("@agentic-toolkit/data/markdown", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  markdownApi: { publish: publishMock, unpublish: vi.fn() },
}));

const DOC = {
  id: "doc-1",
  title: "Intelligence at the Edges",
  visibility: "public",
  publicRoute: "intelligence-at-the-edges",
} as unknown as ResearchDocument;

const DRAFT = {
  id: "doc-2",
  title: "A Draft Paper",
  visibility: "private",
  publicRoute: null,
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

describe("PublishSection — draft", () => {
  it("trims and lowercases the route before publishing — an untouched raw `route` prop is not what goes out", () => {
    // The identity field above the body is free to hand this a raw, unnormalised value (mixed
    // case, stray whitespace); the wiring that fixes that up before it reaches the network call
    // was entirely uncovered — N8 dropped it and this suite stayed green.
    render(
      <PublishSection
        doc={DRAFT}
        route="  MyRoute  "
        userSlug="mikefullerton"
        workspaceSlug="mikefullerton"
        onChanged={async () => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^publish$/i }));
    expect(publishMock).toHaveBeenCalledWith("doc-2", "myroute", { workspace: "mikefullerton" });
  });

  it("disables Publish when the verdict is Unavailable, even though the format regex would accept it", () => {
    // Save is gated on the same verdict (see ResearchPane's onSave); Publish must agree, or the
    // two paths to the same route disagree with each other. N6 dropped `!routeValid` from the
    // OLD gate and this suite never caught it because it never covered the draft branch at all —
    // this pins the NEW verdict-based gate the same way.
    render(
      <PublishSection
        doc={DRAFT}
        route="taken-route"
        verdict={{ status: "unavailable", reason: "That route is taken." }}
        userSlug="mikefullerton"
        workspaceSlug="mikefullerton"
        onChanged={async () => {}}
      />,
    );
    expect(screen.getByRole("button", { name: /^publish$/i })).toBeDisabled();
  });

  it("states the reason in the card when an unavailable slug disables Publish (FIX C8)", () => {
    // The gate itself was already covered above; what wasn't was WHY it's disabled being
    // stated anywhere Publish itself lives — the reason previously only showed up in the
    // identity field above the body, so a disabled button in this card had no explanation of
    // its own. Reuses the same `verdict` prop the gate reads, not a recomputed check.
    render(
      <PublishSection
        doc={DRAFT}
        route="taken-route"
        verdict={{ status: "unavailable", reason: "That route is taken." }}
        userSlug="mikefullerton"
        workspaceSlug="mikefullerton"
        onChanged={async () => {}}
      />,
    );
    const publishButton = screen.getByRole("button", { name: /^publish$/i });
    expect(publishButton).toBeDisabled();
    // The FULL rendered copy (FIX E2) — exact, not `toHaveTextContent`'s substring match (jest-dom
    // 6.9.1's `toHaveTextContent`, verified by running it: appending "EXTRA JUNK COPY" to the
    // rendered text left this exact assertion, when it used `toHaveTextContent`, green). `.textContent`
    // equality is exact, so a mangled or truncated "Can't publish: " prefix — or trailing junk —
    // fails it.
    const reason = document.querySelector('[data-slot="publish-disabled-reason"]');
    expect(reason?.textContent).toBe("Can’t publish: That route is taken.");
    // FIX E5: the reason is linked to the button via aria-describedby, the same pattern the
    // identity field already uses for its own verdict — a screen-reader user landing on a
    // disabled Publish button must hear WHY, not just that it's disabled.
    expect(reason).toHaveAttribute("id");
    expect(publishButton).toHaveAttribute("aria-describedby", reason?.id);
  });

  it("falls back to a generic reason when the verdict is unavailable but names none (FIX E2)", () => {
    // Exercises the `verdict?.reason ?? "this slug is unavailable."` branch the test above
    // cannot reach, since that test always supplies a `reason`.
    render(
      <PublishSection
        doc={DRAFT}
        route="taken-route"
        verdict={{ status: "unavailable", reason: null }}
        userSlug="mikefullerton"
        workspaceSlug="mikefullerton"
        onChanged={async () => {}}
      />,
    );
    expect(screen.getByRole("button", { name: /^publish$/i })).toBeDisabled();
    expect(
      document.querySelector('[data-slot="publish-disabled-reason"]'),
    ).toHaveTextContent("Can’t publish: this slug is unavailable.");
  });

  it("says nothing about a disabled Publish when the slug IS available", () => {
    render(
      <PublishSection
        doc={DRAFT}
        route="fresh-route"
        verdict={{ status: "available", reason: null }}
        userSlug="mikefullerton"
        workspaceSlug="mikefullerton"
        onChanged={async () => {}}
      />,
    );
    const publishButton = screen.getByRole("button", { name: /^publish$/i });
    expect(publishButton).toBeEnabled();
    expect(screen.queryByText(/that route is taken/i)).toBeNull();
    // The reason paragraph is now mounted UNCONDITIONALLY (FIX F3) — it is the `aria-live`
    // region a screen reader watches, and a region that only exists once there is something to
    // announce is a region assistive tech never started observing. Only its TEXT is
    // conditional, so it renders empty here rather than absent.
    expect(document.querySelector('[data-slot="publish-disabled-reason"]')).toHaveTextContent("");
    // aria-describedby still points nowhere meaningful — nothing to announce (FIX E5).
    expect(publishButton).not.toHaveAttribute("aria-describedby");
  });

  it("disables Publish for a route that fails the format check, verdict or no verdict — N6's original gap", () => {
    // N6 dropped `!routeValid` from the disabled expression and the suite at the time never
    // caught it: every existing test only ever exercised routes that pass PUBLIC_ROUTE_RE, so
    // nothing here independently pinned the format half of the gate. An internal space survives
    // trim()+toLowerCase(), so this route is still invalid after normalisation.
    render(
      <PublishSection
        doc={DRAFT}
        route="not a valid route"
        userSlug="mikefullerton"
        workspaceSlug="mikefullerton"
        onChanged={async () => {}}
      />,
    );
    expect(screen.getByRole("button", { name: /^publish$/i })).toBeDisabled();
  });

  it("leaves Publish enabled when no verdict is supplied at all — the gate must not punish a host with no check", () => {
    render(
      <PublishSection
        doc={DRAFT}
        route="fresh-route"
        userSlug="mikefullerton"
        workspaceSlug="mikefullerton"
        onChanged={async () => {}}
      />,
    );
    expect(screen.getByRole("button", { name: /^publish$/i })).toBeEnabled();
  });
});
