import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

// SiteHomeRoute's whole job is the ASSEMBLY: read the two route params, hand the workspace to the
// shell and the path below it to the site's parser, mount the site's view inside the shell. So the
// shell is stubbed here — its resolution behaviour is siteHomeShell.test.tsx's subject, and running
// the real one would make every assertion below wait on a workspace fetch to answer a question
// about argument plumbing. The stub calls its child immediately with a fixed scope, which is
// precisely the contract the real shell honours once resolved.
//
// That fixed scope is deliberately UNFORGEABLE: neither value can be derived from the URL, the model, or anything
// else in the route's reach. A route that recomputed the scope instead of forwarding the shell's
// would produce "acme" and "/acme" from the params below — which is exactly what the first
// version of this file used here, and why its forwarding test could not fail. (Caught by
// mutation: rewriting the route to recompute left all 7 green.)
const SHELL_SCOPE = {
  workspaceSlug: "ws-from-shell",
  scopedBase: "/base-only-the-shell-knows",
  workspace: {
    slug: "ws-from-shell",
    name: "Only The Shell Knows",
    kind: "organization" as const,
  },
};

const shellProps = vi.fn();
vi.mock("../home/SiteHomeShell", () => ({
  SiteHomeShell: (props: {
    basePath: string;
    workspaceSlug?: string;
    children: (scope: typeof SHELL_SCOPE) => React.ReactNode;
  }) => {
    shellProps(props);
    return (
      <div data-testid="shell" data-base={props.basePath} data-slug={props.workspaceSlug ?? "none"}>
        {props.children(SHELL_SCOPE)}
      </div>
    );
  },
}));

let params: { workspace?: string; path?: string | string[] } | null = {};
vi.mock("next/navigation", () => ({
  useParams: () => params,
}));

const { SiteHomeRoute } = await import("../home/SiteHomeRoute");
const { defineSiteHome } = await import("../home/SiteHomeModel");

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  params = {};
});

/** A site's model, in the shape a real site writes it. `parse` returns a distinctive object so
 *  the tests can prove which segments reached it. */
const parse = vi.fn((segments: string[]) => ({ depth: segments.length, segments }));
const model = defineSiteHome({
  basePath: "",
  parse,
  render: ({ workspaceSlug, scopedBase, workspace, view }) => (
    <div
      data-testid="view"
      data-workspace={workspaceSlug}
      data-scoped-base={scopedBase}
      data-workspace-name={workspace.name}
      data-segments={view.segments.join(",")}
      data-depth={String(view.depth)}
    />
  ),
});

describe("SiteHomeRoute", () => {
  it("hands the workspace param to the shell and parses only the path below it", () => {
    params = { workspace: "acme", path: ["proj-1", "notes"] };
    render(<SiteHomeRoute model={model} />);

    // The workspace goes to the shell, never to the site's parser — a site that needs it reads
    // `workspaceSlug` off the scope.
    expect(screen.getByTestId("shell")).toHaveAttribute("data-slug", "acme");
    expect(parse).toHaveBeenCalledWith(["proj-1", "notes"]);
    expect(screen.getByTestId("view")).toHaveAttribute("data-segments", "proj-1,notes");
  });

  it("passes the model's basePath through to the shell", () => {
    params = { workspace: "acme" };
    render(<SiteHomeRoute model={{ ...model, basePath: "/w" }} />);

    expect(screen.getByTestId("shell")).toHaveAttribute("data-base", "/w");
  });

  it("hands the site's render the scope the shell built, not one of its own", () => {
    params = { workspace: "acme" };
    render(<SiteHomeRoute model={model} />);

    // The params say "acme" and the model's basePath is "", so a route that recomputed the scope
    // would put "acme" and "/acme" here — and the assertion would still pass if the sentinels
    // below were those strings. They are not, so only forwarding can satisfy it. Recomputing is
    // the duplication this whole contract removes, and it would silently disagree with the shell
    // the moment the shell resolves a DIFFERENT workspace than the URL asked for.
    const view = screen.getByTestId("view");
    expect(view).toHaveAttribute("data-workspace", SHELL_SCOPE.workspaceSlug);
    expect(view).toHaveAttribute("data-scoped-base", SHELL_SCOPE.scopedBase);
    // The resolved ROW travels the same way, and it is the one field the route could not fabricate
    // even if it tried: a name lives only in the workspace list, which the route never fetches.
    expect(view).toHaveAttribute("data-workspace-name", SHELL_SCOPE.workspace.name);
  });

  it("hands the shell NO workspace at the site's bare /home mount, which is what redirects", () => {
    // `app/home/page.tsx` has no dynamic segments at all, so neither param exists. That is the
    // entire redirect mechanism: an absent workspace is a state the shell already owns, and it
    // answers by resolving one and replacing the URL. `parse` still runs (the shell decides
    // whether its result is ever rendered), and must see [] rather than [undefined].
    params = {};
    render(<SiteHomeRoute model={model} />);

    expect(screen.getByTestId("shell")).toHaveAttribute("data-slug", "none");
    expect(parse).toHaveBeenCalledWith([]);
    expect(screen.getByTestId("view")).toHaveAttribute("data-depth", "0");
  });

  it("unwraps a single segment Next may hand over unwrapped", () => {
    // Next types a catch-all param as `string | string[]`. A bare string reaching an array
    // position would spread into CHARACTERS — `/acme/notes` would parse as ["n","o","t","e","s"].
    // Cheap to get wrong, invisible until a one-segment URL below the workspace.
    params = { workspace: "acme", path: "notes" };
    render(<SiteHomeRoute model={model} />);

    expect(screen.getByTestId("shell")).toHaveAttribute("data-slug", "acme");
    expect(parse).toHaveBeenCalledWith(["notes"]);
    expect(screen.getByTestId("view")).toHaveAttribute("data-segments", "notes");
  });

  it("treats a workspace with nothing below it as an empty path", () => {
    // `/acme` — the workspace param is present, the catch-all is omitted entirely.
    params = { workspace: "acme" };
    render(<SiteHomeRoute model={model} />);

    expect(screen.getByTestId("shell")).toHaveAttribute("data-slug", "acme");
    expect(parse).toHaveBeenCalledWith([]);
  });

  it("survives useParams returning null", () => {
    // `useParams` is typed as nullable, and returns null outside a route context. Rendering the
    // bare route is the sane reading; throwing would take the whole page down.
    params = null;
    render(<SiteHomeRoute model={model} />);

    expect(screen.getByTestId("shell")).toHaveAttribute("data-slug", "none");
    expect(parse).toHaveBeenCalledWith([]);
  });
});

describe("defineSiteHome", () => {
  it("returns the model unchanged — it exists for inference, not behaviour", () => {
    // Worth pinning because the temptation to make it do something (defaults, validation) is
    // real, and a site's model is a plain object it may legitimately spread or extend, as the
    // basePath test above does.
    const input = { basePath: "", parse: (s: string[]) => s, render: () => null };
    expect(defineSiteHome(input)).toBe(input);
  });
});
