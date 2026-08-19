// @vitest-environment jsdom
//
// Pins where PersonasSection's "New Persona" lives: the HOME BAR — the strip between the workspace
// bar and the breadcrumb bar — and NOT the persona rail level's own right-justified `+`, which is
// where it used to render (`onNew`/`newLabel` on the level). Creating a persona acts on the PAGE
// (this component supplies level 0 of both the personas and personabuilder sites' /home route), so
// by the fleet's placement rule it belongs to the page's chrome.
//
// EVERY query below is scoped with `within(await screen.findByTestId("home-bar"))`, never a bare
// `screen.*`, and that is what makes these tests capable of failing. `HomeBarPortal` renders its
// children INLINE when there is no `HomeBarHost` above it, so an unscoped
// `screen.getByRole("button", { name: "New Persona" })` finds the button whether it was published
// into the strip or left exactly where it was. Both harnesses below therefore mount a real
// `HomeBarHost`, the way `SiteHomeShell` (templated fleet) and the hub's `WorkspaceShellInner` do.
//
// The component is DUAL-MODE, and both modes are covered here: under a rail host it publishes its
// level and renders only the leaf; with no host above it renders its own HierarchicalDetailView.
// The two sites that mount it reach the first branch — `PersonasFeature` wraps it in
// `RailHostBoundary`, which self-hosts a `StandaloneRailHost` when nothing above it does — while
// an embedded launcher takes the second. A bar published from only one branch is a missing create
// button on whichever set of callers takes the other, and nothing else in the suite would say so.
//
// Mocks are the module boundaries only: the personas data client, auth's error reporter, and the
// two heavy children this file is not about (`PersonaEditor`, whose module pulls in the CRUD
// catalog, and `useUserServices`, which would otherwise spend a real services read on every mount).
// The home-bar mechanism itself runs for real.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import type { ReactNode } from "react";

vi.mock("@agentic-toolkit/auth", () => ({
  reportUnexpectedAuthError: vi.fn(),
}));

vi.mock("@agentic-toolkit/data/personas", () => ({
  api: {
    personas: {
      list: vi.fn(),
      create: vi.fn(),
    },
  },
}));

// Not the subject, and its module resolves the CRUD table catalog at load — stub it the way
// PersonaEditor.test.tsx stubs its own leaf panels. Nothing here opens a persona anyway.
vi.mock("./PersonaEditor", () => ({
  PersonaEditor: () => <div data-testid="persona-editor" />,
}));

// The services list is a second, unrelated read (and its own suite's business). The stub keeps the
// exported cache key intact because PersonasSection's `reload` revalidates by that exact string.
vi.mock("./useUserServices", () => ({
  PERSONA_SERVICES_CACHE_KEY: "persona-services",
  useUserServices: () => ({ items: [], error: null, reload: vi.fn() }),
}));

import { HomeBarHost, RailHostBoundary } from "@agentic-toolkit/resource";
import { ToolkitQueryProvider } from "@agentic-toolkit/data/query";
import { PersonasSection } from "./PersonasSection";
import { api, type Persona } from "@agentic-toolkit/data/personas";

const listPersonas = vi.mocked(api.personas.list);

const PERSONA = {
  id: "p1",
  name: "Bob",
  slug: "bob",
  description: "A dog namer.",
  model: "",
  modelPrompt: "",
  visibility: "private",
} as unknown as Persona;

beforeEach(() => {
  vi.clearAllMocks();
  listPersonas.mockResolvedValue([PERSONA]);
});

afterEach(cleanup);

/** The page chrome the two sites put above this feature: the toolkit's own react-query provider
 *  (PersonasSection reads the toolkit's QueryClient, not a host's) and a real `HomeBarHost`.
 *  `railHost` picks the branch: `true` adds the `RailHostBoundary` `PersonasFeature` supplies,
 *  which self-hosts a rail host, so the component takes its published-level branch. */
function Chrome({ children, railHost }: { children: ReactNode; railHost: boolean }) {
  return (
    <ToolkitQueryProvider>
      <HomeBarHost>
        {railHost ? <RailHostBoundary>{children}</RailHostBoundary> : children}
      </HomeBarHost>
    </ToolkitQueryProvider>
  );
}

describe("PersonasSection publishes New Persona into the home bar", () => {
  // The branch the personas and personabuilder sites actually take.
  it("publishes the button into the strip under a rail host", async () => {
    render(
      <Chrome railHost>
        <PersonasSection />
      </Chrome>,
    );

    const bar = within(await screen.findByTestId("home-bar"));
    expect(bar.getByRole("button", { name: "New Persona" })).not.toBeNull();
    // And ONLY there. The rail's own `+` takes its accessible name from `newLabel`
    // (`topic-detail.tsx`: `aria-label={newLabel ?? "New"}`), so a create left on the level as well
    // as published here would show up as a second match — which every `within(strip)` assertion
    // above would happily ignore.
    expect(screen.getAllByRole("button", { name: "New Persona" })).toHaveLength(1);
  });

  // The other branch: no host above, so PersonasSection renders its own HierarchicalDetailView.
  it("publishes the button into the strip with no rail host above", async () => {
    render(
      <Chrome railHost={false}>
        <PersonasSection />
      </Chrome>,
    );

    const bar = within(await screen.findByTestId("home-bar"));
    expect(bar.getByRole("button", { name: "New Persona" })).not.toBeNull();
    expect(screen.getAllByRole("button", { name: "New Persona" })).toHaveLength(1);
  });

  it("opens the create modal from the strip's button — the portal keeps it in the React tree", async () => {
    // A portal moves children out of the DOM subtree but NOT out of the React tree, which is the
    // whole reason a control in the page's chrome can still drive this component's state. Clicking
    // the button where the user finds it must set `newOpen` here; a button that rendered in the
    // strip but no longer reached `setNewOpen` would pass both placement tests above.
    render(
      <Chrome railHost>
        <PersonasSection />
      </Chrome>,
    );

    const bar = within(await screen.findByTestId("home-bar"));
    expect(screen.queryByRole("dialog", { name: "New persona" })).toBeNull();
    fireEvent.click(bar.getByRole("button", { name: "New Persona" }));
    expect(await screen.findByRole("dialog", { name: "New persona" })).not.toBeNull();
  });

  it("publishes the button with an EMPTY persona list", async () => {
    // Unconditional, exactly as `onNew` was: no personas is precisely when the first create
    // matters most, so gating the bar on a loaded or non-empty list would strand a new tenant with
    // no way to create anything at all.
    listPersonas.mockResolvedValue([]);
    render(
      <Chrome railHost>
        <PersonasSection />
      </Chrome>,
    );

    const bar = within(await screen.findByTestId("home-bar"));
    expect(bar.getByRole("button", { name: "New Persona" })).not.toBeNull();
  });
});
