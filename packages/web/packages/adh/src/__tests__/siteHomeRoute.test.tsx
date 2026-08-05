import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

// SiteHomeRoute's whole job is the ASSEMBLY: read the path, split the workspace off the front,
// hand the rest to the site's parser, mount the site's view inside the shell. So the shell is
// stubbed here — its resolution behaviour is siteHomeShell.test.tsx's subject, and running the
// real one would make every assertion below wait on a workspace fetch to answer a question about
// argument plumbing. The stub calls its child immediately with a fixed scope, which is precisely
// the contract the real shell honours once resolved.
//
// That fixed scope is deliberately UNFORGEABLE: neither value can be derived from the URL, the model, or anything
// else in the route's reach. A route that recomputed the scope instead of forwarding the shell's
// would produce "acme" and "/home/acme" from the params below — which is exactly what the first
// version of this file used here, and why its forwarding test could not fail. (Caught by
// mutation: rewriting the route to recompute left all 7 green.)
const SHELL_SCOPE = { workspaceSlug: "ws-from-shell", scopedBase: "/base-only-the-shell-knows" };

const shellProps = vi.fn();
vi.mock("../home/SiteHomeShell", () => ({
  SiteHomeShell: (props: {
    basePath: string;
    workspaceSlug?: string;
    children: (scope: { workspaceSlug: string; scopedBase: string }) => React.ReactNode;
  }) => {
    shellProps(props);
    return (
      <div data-testid="shell" data-base={props.basePath} data-slug={props.workspaceSlug ?? "none"}>
        {props.children(SHELL_SCOPE)}
      </div>
    );
  },
}));

let params: { path?: string | string[] } | null = {};
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
  basePath: "/home",
  parse,
  render: ({ workspaceSlug, scopedBase, view }) => (
    <div
      data-testid="view"
      data-workspace={workspaceSlug}
      data-scoped-base={scopedBase}
      data-segments={view.segments.join(",")}
      data-depth={String(view.depth)}
    />
  ),
});

describe("SiteHomeRoute", () => {
  it("splits the workspace off the front and parses only what is below it", () => {
    params = { path: ["acme", "proj-1", "notes"] };
    render(<SiteHomeRoute model={model} />);

    // The workspace segment goes to the shell, never to the site's parser — a site that needs it
    // reads `workspaceSlug` off the scope.
    expect(screen.getByTestId("shell")).toHaveAttribute("data-slug", "acme");
    expect(parse).toHaveBeenCalledWith(["proj-1", "notes"]);
    expect(screen.getByTestId("view")).toHaveAttribute("data-segments", "proj-1,notes");
  });

  it("passes the model's basePath through to the shell", () => {
    params = { path: ["acme"] };
    render(<SiteHomeRoute model={{ ...model, basePath: "/w" }} />);

    expect(screen.getByTestId("shell")).toHaveAttribute("data-base", "/w");
  });

  it("hands the site's render the scope the shell built, not one of its own", () => {
    params = { path: ["acme"] };
    render(<SiteHomeRoute model={model} />);

    // The params say "acme" and the model's basePath says "/home", so a route that recomputed the
    // scope would put "acme" and "/home/acme" here — and the assertion would still pass if the
    // sentinels below were those strings. They are not, so only forwarding can satisfy it.
    // Recomputing is the duplication this whole contract removes, and it would silently disagree
    // with the shell the moment the shell resolves a DIFFERENT workspace than the URL asked for.
    const view = screen.getByTestId("view");
    expect(view).toHaveAttribute("data-workspace", SHELL_SCOPE.workspaceSlug);
    expect(view).toHaveAttribute("data-scoped-base", SHELL_SCOPE.scopedBase);
  });

  it("treats the bare route as an empty path, with no workspace for the shell", () => {
    // `/home` — Next omits the param entirely for an empty optional catch-all. `parse` still runs
    // (the shell decides whether the result is ever rendered), and must see [] rather than
    // [undefined].
    params = {};
    render(<SiteHomeRoute model={model} />);

    expect(screen.getByTestId("shell")).toHaveAttribute("data-slug", "none");
    expect(parse).toHaveBeenCalledWith([]);
    expect(screen.getByTestId("view")).toHaveAttribute("data-depth", "0");
  });

  it("unwraps a single segment Next may hand over unwrapped", () => {
    // Next types a catch-all param as `string | string[]`. A bare string reaching the destructure
    // would spread into CHARACTERS — "/home/acme" would parse as workspace "a" with segments
    // ["c","m","e"]. Cheap to get wrong, invisible until a one-segment URL.
    params = { path: "acme" };
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
    const input = { basePath: "/home", parse: (s: string[]) => s, render: () => null };
    expect(defineSiteHome(input)).toBe(input);
  });
});
