import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { render, screen, waitFor, cleanup, configure } from "@testing-library/react";

// Same headroom, and for the same reason, as siteHomeShell.test.tsx next door: every wait here is
// for a microtask chain that settles in single-digit milliseconds standalone, and the only thing a
// larger ceiling changes is how long a genuinely broken run takes to go red.
configure({ asyncUtilTimeout: 5000 });

/**
 * What the shared cache BUYS the workspace route, asserted against the REAL hooks.
 *
 * siteHomeShell.test.tsx — the 58-case file next door — stubs the whole `@agentic-toolkit/data`
 * boundary, `useResourceItemQuery` included, so that each of its cases starts from a state it
 * declares rather than one it inherits from whichever case ran before it. That is the right trade
 * for a file about WHICH workspace resolves and WHEN children mount, and it is precisely why the
 * two claims this feature exists to make cannot be tested there: both are claims about what one
 * mount leaves behind for the NEXT one, which a per-mount stub defines out of existence.
 *
 * So this file mocks the network and nothing else. `workspacesApi`, `workspacePrefsApi` and the
 * localStorage pair are doubles; the hooks, the module-scope QueryClient and the whole of
 * `useWorkspaceRoute` are real. The browser cache is held deliberately COLD (`readCached` answers
 * null throughout) so that anything a remount knows, it knows from the query cache.
 */

// A stateful router double, trimmed to what these two cases need. `replace` records the call and
// then moves the live slug a microtask later — the App Router updates the param on a LATER render
// than the one that asked for it, and collapsing that gap would hide the half-state where the URL
// still names the old workspace.
let liveSetSlug: (slug: string | undefined) => void = () => {};
let livePathname = "";
const extractPath = (href: string): string => href.split(/[?#]/)[0]!;
const replace = vi.fn((href: string) => {
  void Promise.resolve().then(() => {
    livePathname = extractPath(href);
    liveSetSlug(extractPath(href).split("/").filter(Boolean)[0]!);
  });
});
const push = vi.fn();
const routerDouble = { replace, push, prefetch: vi.fn() };
vi.mock("next/navigation", () => ({
  useRouter: () => routerDouble,
  usePathname: () => livePathname,
  notFound: () => {
    throw new Error("NEXT_HTTP_ERROR_FALLBACK;404");
  },
}));

const list = vi.fn();
const prefsGet = vi.fn();
const prefsPut = vi.fn();
const readCached = vi.fn();
const writeCached = vi.fn();

// `importOriginal`, NOT an object literal — that is the whole point of this file. Only the four
// doors to the network and to localStorage are replaced; `useResourceList`,
// `useResourceItemQuery` and `useResourceItemWriter` are the shipped implementations, reading and
// writing the one module-scope QueryClient. The cache that client holds outlives `cleanup()`,
// which is exactly the property under test — and exactly the property `../data/vitest-setup.ts`
// (wired into this package's vitest.config.ts) clears between tests so one case cannot seed the
// next.
vi.mock("@agentic-toolkit/data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@agentic-toolkit/data")>();
  return {
    ...actual,
    workspacesApi: { list: () => list() },
    workspacePrefsApi: {
      get: () => prefsGet(),
      put: (p: unknown) => {
        prefsPut(p);
        return Promise.resolve();
      },
    },
    readCachedWorkspace: () => readCached(),
    writeCachedWorkspace: (s: string) => writeCached(s),
  };
});

// The picker is stubbed for the same reason as next door: its trigger is a Base UI menu needing
// pointer plumbing this package does not carry as a devDependency, and nothing here is about it.
vi.mock("../home/WorkspacePicker", () => ({
  WorkspacePicker: ({ selected }: { selected: string | null }) => (
    <div data-testid="picker" data-selected={selected ?? "none"} />
  ),
}));

const { SiteHomeShell } = await import("../home/SiteHomeShell");
const { __resetSeededWorkspace } = await import("../home/useWorkspaceRoute");

const WORKSPACES = [
  { slug: "mine", name: "My Workspace", kind: "individual" as const },
  { slug: "acme", name: "Acme", kind: "organization" as const },
];

/** The live-URL harness, same shape as next door: `replace` feeds its href back in as
 *  `workspaceSlug`, so a case observes where the shell finally LANDS rather than only what it
 *  asked for. The assignment is in the render body so it points at this instance's setter before
 *  the shell's effects can fire. */
function Shell({ workspaceSlug }: { workspaceSlug?: string }) {
  const [slug, setSlug] = useState<string | undefined>(workspaceSlug);
  liveSetSlug = setSlug;
  return (
    <SiteHomeShell workspaceSlug={slug}>
      {({ workspaceSlug: ws }) => (
        <div data-testid="feature" data-workspace={ws}>
          the feature
        </div>
      )}
    </SiteHomeShell>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  __resetSeededWorkspace();
  liveSetSlug = () => {};
  livePathname = "";
  window.history.replaceState({}, "", "/");
  list.mockResolvedValue(WORKSPACES);
  // Cold throughout. Everything a remount below knows about the preference, it knows from the
  // query cache — there is no browser cache standing behind it to make a broken read look fine.
  readCached.mockReturnValue(null);
});
afterEach(cleanup);

describe("the workspace preference under the shared cache", () => {
  it("reads the preference ONCE across two mounts, and the second paints with no wait", async () => {
    prefsGet.mockResolvedValue({ slug: "acme" });

    // Mount one: a site's bare `/home`. Nothing is cached, so this is the mount that pays — it
    // waits on the list and on the preference, then seeds `acme` into the URL.
    render(<Shell />);
    await waitFor(() =>
      expect(screen.getByTestId("feature")).toHaveAttribute("data-workspace", "acme"),
    );
    expect(replace).toHaveBeenCalledWith("/acme", { scroll: false });
    expect(prefsGet).toHaveBeenCalledTimes(1);

    // Mount two is the topic click: the App Router folds the dynamic segment's value into the page
    // subtree's React key, so `/acme/...` builds a whole new tree with a fresh `useWorkspaceRoute`
    // in it. This is the mount the feature exists for.
    cleanup();
    render(<Shell workspaceSlug="acme" />);

    // NO `waitFor`, deliberately. The assertion is that the feature is on screen in the render
    // `render()` itself produced — the difference between a click that repaints and a click that
    // blanks the page while a round trip it did not need comes back.
    expect(screen.getByTestId("feature")).toHaveAttribute("data-workspace", "acme");
    // And the round trip genuinely did not happen. One read of each across both mounts: the
    // preference the second mount resolved against is the answer the first one already had.
    expect(prefsGet).toHaveBeenCalledTimes(1);
    expect(list).toHaveBeenCalledTimes(1);
    // Reading is not writing: nothing here was an explicit choice, so no preference is recorded.
    expect(prefsPut).not.toHaveBeenCalled();
  });

  it("writes a chosen workspace THROUGH the cache, so the next mount cannot read the pre-PUT row back", async () => {
    // A caller who has never chosen. `get()` resolves `{}` for them — never a 404 — so this is the
    // cold-preference case, and it is the one where a missing write-through does real damage.
    prefsGet.mockResolvedValue({});

    // Mount one: an explicit deep link to `/acme`. That is a choice, so it is persisted.
    render(<Shell workspaceSlug="acme" />);
    await waitFor(() => expect(prefsPut).toHaveBeenCalledWith({ slug: "acme" }));
    await waitFor(() =>
      expect(screen.getByTestId("feature")).toHaveAttribute("data-workspace", "acme"),
    );

    // Mount two: back to the bare `/home`, which has to seed a workspace from the preference.
    // The cached ROW is what it reads — the browser cache is cold and no second GET is issued —
    // so if the PUT had not been written into the cache entry, this mount would read the `{}` the
    // first mount fetched BEFORE choosing, fall through to the first row of the list, and land the
    // user on `mine`: the pre-PUT answer, resurrected one mount later.
    cleanup();
    render(<Shell />);
    await waitFor(() =>
      expect(screen.getByTestId("feature")).toHaveAttribute("data-workspace", "acme"),
    );
    expect(replace).toHaveBeenCalledWith("/acme", { scroll: false });

    expect(prefsGet).toHaveBeenCalledTimes(1);
    // Exactly one PUT for one choice. A remount re-persisting what it merely READ would be a write
    // the user never asked for, and the second mount seeded its slug rather than being told it.
    expect(prefsPut).toHaveBeenCalledTimes(1);
    // Nothing rolled the browser cache back either: `acme` from the choice, `acme` again from the
    // second mount mirroring the row it read. `mine` never touches disk.
    expect(writeCached.mock.calls.flat()).toEqual(["acme", "acme"]);
  });
});
