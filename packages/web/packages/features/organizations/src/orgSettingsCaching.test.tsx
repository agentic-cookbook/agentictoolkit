// @vitest-environment jsdom
//
// THE ORG RECORD IS CACHED, AND THE SETTINGS LIST SAYS WHEN IT IS BEING READ.
//
// Clicking Settings used to resolve the organization from the server every single time and blank
// the pane to "Loading…" while it did — the App Router folds the org's URL segment into the page
// subtree's key, so the pane remounts on every visit and a plain `useQuery` starts from nothing.
// The three things that fixed it are all invisible to the type checker and to every other test in
// this package: the record has to be read through the SHARED item cache (a private key would
// typecheck and still miss on every visit), the read has to be held by the GROUP (a member pane
// cannot reach the level its group publishes, so a read held one component lower can never raise
// the spinner), and the form has to be locked while a cached copy is being revalidated (or an edit
// is typed into last week's name and PATCHed over what the server has now).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useEffect } from "react";
import { render, screen, cleanup, within, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Organization } from "@agentic-toolkit/data/organizations";

// OrgSettingsGroup renders inside a rail host, and StandaloneRailHost's exit guard reaches for the
// App Router. Nothing here navigates; this is the context those hooks need to exist at all.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

// Only the transport is replaced — `Organization` and every other export of the module stay real,
// so the fixtures below are genuine records rather than stand-ins for the shape the pane reads.
const { resolve } = vi.hoisted(() => ({ resolve: vi.fn() }));
vi.mock("@agentic-toolkit/data/organizations", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@agentic-toolkit/data/organizations")>()),
  organizationsApi: { resolve, rename: vi.fn(), archive: vi.fn() },
}));

// The module-scope client itself — the one the record under test lives in. Reached through the
// `/query` subpath because that is where it is published; the package's main barrel does not
// re-export it, deliberately, since application code is meant to reach it through the hooks.
import { getToolkitQueryClient } from "@agentic-toolkit/data/query";
import { useResourceItemPrefetch } from "@agentic-toolkit/data";
import { organizationsApi } from "@agentic-toolkit/data/organizations";
import { RailHostBoundary } from "@agentic-toolkit/resource";
import {
  OrgSettingsGroup,
  ORG_RECORD_CACHE_KEY,
  type OrgSettingsHrefs,
} from "./OrgSettingsPane";

const HREFS: OrgSettingsHrefs = {
  renamed: (slug) => `/${slug}/settings`,
  archived: "/home",
};

const ACME: Organization = {
  id: "org-1",
  slug: "acme",
  name: "Acme",
  description: null,
} as Organization;

/** The same org after someone renamed it elsewhere — what a revalidation brings back. */
const RENAMED: Organization = { ...ACME, name: "Acme Inc" };

/** The group with Profile selected, inside a real rail host so the spinner under test is the one
 *  the user sees rather than a harness stand-in for the flag.
 *
 *  Two query clients are in play and only one of them is this file's subject. The record under
 *  test lives in the toolkit's MODULE-scope client, which `useResourceItem` holds itself and which
 *  survives the `cleanup()` between the two mounts a test makes — that survival IS the cache being
 *  measured. The provider below is the OTHER one: the form invalidates the workspaces list after a
 *  save and probes slug availability through plain `useQuery`, which read React context. Fresh per
 *  call, so nothing the form does leaks from one mount to the next and confuses the first for the
 *  second. */
function renderSettings() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <RailHostBoundary>
        <OrgSettingsGroup
          slug="acme"
          hrefs={HREFS}
          leaf={{ leafId: "profile", onSelect: () => {} }}
        />
      </RailHostBoundary>
    </QueryClientProvider>,
  );
}

/** The hover warm-up, exactly as {@link OrganizationsFeature} spells it — same cache key, same
 *  loader, same id (the slug, which is what `getId` hands the explorer). Reproduced as a hook call
 *  rather than by mounting the whole feature, which would drag in the workspaces list, the teams
 *  feature and the ecosystem-config group to prove one thing about a cache key. */
function warmOrgRecord(id: string) {
  function Warm() {
    const prefetch = useResourceItemPrefetch<Organization>(
      ORG_RECORD_CACHE_KEY,
      organizationsApi.resolve,
    );
    useEffect(() => prefetch(id), [prefetch]);
    return null;
  }
  render(<Warm />);
}

const rail = (): HTMLElement => screen.getByRole("complementary", { name: "Topic list" });
const spinner = (): HTMLElement | null =>
  within(rail()).queryByRole("status", { name: "Loading" });
const nameField = (): HTMLInputElement => screen.getByLabelText("name") as HTMLInputElement;

beforeEach(() => {
  resolve.mockResolvedValue(ACME);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("the organization's own record", () => {
  it("spins the Settings list while the record is read, and stops when it lands", async () => {
    // Held open by hand, so the in-flight moment is a state to stand in rather than a frame to
    // race. Nothing is cached on a first visit, so this is the one time the user genuinely waits.
    let land: (org: Organization) => void = () => {
      throw new Error("resolve was never called");
    };
    resolve.mockImplementation(
      () =>
        new Promise<Organization>((r) => {
          land = r;
        }),
    );
    renderSettings();

    // The group's four rows are static, so the spinner is reporting the BODY behind the selected
    // one — the only read this group makes.
    expect(spinner()).not.toBeNull();
    expect(within(rail()).getByRole("button", { name: "Profile" })).not.toBeNull();
    expect(screen.getByText("Loading…")).not.toBeNull();

    land(ACME);
    await waitFor(() => expect(spinner()).toBeNull());
    expect(nameField().value).toBe("Acme");
  });

  it("paints the second visit from cache, with no second read", async () => {
    renderSettings();
    await screen.findByLabelText("name");
    expect(resolve).toHaveBeenCalledTimes(1);
    cleanup();

    // THE POINT OF THE WHOLE EXERCISE. Re-entering Settings remounts the pane — the App Router
    // gives the org's segment its own subtree — and the record is simply there. Asserted
    // SYNCHRONOUSLY, with no `find`/`waitFor`: a pane that painted after an await would be one
    // that went back to the server, which is the behaviour this replaced.
    renderSettings();
    expect(nameField().value).toBe("Acme");
    expect(spinner()).toBeNull();
    expect(resolve).toHaveBeenCalledTimes(1);
  });

  // The other half of the same claim, one step earlier: the entry the hover warms has to be the
  // entry the click reads. A prefetch onto a key nobody reads is the worst of both — it spends the
  // request AND leaves the click cold — and it is invisible to the type checker, to the explorer's
  // own prefetch test (which only proves the callback fires), and to the three tests above (which
  // only prove the group reads what the group wrote).
  it("opens with no read at all when the hover already warmed the record", async () => {
    warmOrgRecord("acme");
    await waitFor(() => expect(resolve).toHaveBeenCalledTimes(1));
    // The warm-up's own promise has resolved; this lets the cache take delivery of it before the
    // group asks, which is the ~100ms of hover the user spends in the real thing.
    await act(async () => {});
    cleanup();

    renderSettings();
    expect(nameField().value).toBe("Acme");
    expect(spinner()).toBeNull();
    expect(resolve).toHaveBeenCalledTimes(1);
  });

  it("locks the form while a stale copy is being revalidated, then unlocks on the fresh one", async () => {
    renderSettings();
    await screen.findByLabelText("name");
    cleanup();

    // What five minutes' `staleTime` does on its own, done deliberately: the cached copy is still
    // painted, it is simply no longer trusted, so the next mount reads behind it. Invalidating the
    // whole client rather than one key keeps the test from restating the cache key, which is the
    // hook's business and not this pane's.
    await getToolkitQueryClient().invalidateQueries();

    let land: (org: Organization) => void = () => {
      throw new Error("the revalidation never ran");
    };
    resolve.mockImplementation(
      () =>
        new Promise<Organization>((r) => {
          land = r;
        }),
    );
    renderSettings();

    // Instant, stale, and locked — all three at once. Without the lock the user could type into
    // "Acme" here and Save it over whatever the server is about to hand back.
    expect(nameField().value).toBe("Acme");
    expect(nameField().disabled).toBe(true);
    expect(spinner()).not.toBeNull();

    land(RENAMED);
    await waitFor(() => expect(nameField().disabled).toBe(false));
    expect(nameField().value).toBe("Acme Inc");
    expect(spinner()).toBeNull();
  });
});
