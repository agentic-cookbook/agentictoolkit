// @vitest-environment jsdom
//
// Component test for ResearchFeature — the /research workspace: a master/detail surface over
// the signed-in user's markdown research documents. Only the data domain boundary
// (@agentic-toolkit/data/markdown), the Next navigation hook, and @agentic-toolkit/auth's
// useAuth are mocked, so the list-publish → create → open-via-URL wiring is exercised, not the
// transport.
//
// ResearchPane PUBLISHES its documents list as ONE rail level (via useStackLevel) into a rail
// HOST rather than rendering its own list — the button bar (Save/Cancel/Delete) is the only thing
// MasterDetailLeaf renders directly. So the harness below (mirroring ProjectsFeature.test.tsx's
// Rail) renders the published level's items, standing in for the hub's workspace shell.
//
// The pane's two PAGE-level controls are no longer part of that level: the search/category/tag
// filters and the "New document" create are published into the HOME BAR (the strip between the
// workspace bar and the breadcrumb bar) via HomeBarPortal, not handed to the rail as `railSlot`
// and `onNew`. The Harness therefore mounts a real `HomeBarHost` the way SiteHomeShell does — and
// it MUST: without a host, HomeBarPortal renders its children inline as a fallback, so every
// unscoped `screen.*` query would pass identically whether the publish works or not.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, fireEvent, waitFor, within, cleanup } from "@testing-library/react";
import { useMemo, useState, type ReactNode } from "react";
import {
  HomeBarHost,
  RailHostContext,
  type RailHostRegistry,
  type RegisteredLevels,
} from "@agentic-toolkit/resource";
import type { TopicLevel } from "@agentic-toolkit/ui/blocks";

// useBasePathRoute (ResearchFeature's URL wiring) reads next/navigation's useRouter; a stub is
// enough for most tests, which assert on the API calls rather than the resulting route. The
// "two bases" tests below (docBasePath !== basePath) DO assert on the route, so `push` is hoisted
// to one shared spy rather than minted fresh per `useRouter()` call — a fresh `vi.fn()` per call
// would leave no way to read back what a later render's `pushSegment` actually did.
const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), prefetch: vi.fn() }),
}));

// ResearchPane reads useAuth() directly (for the userSlug fallback) — stub a signed-in user so
// it renders without an AuthProvider. reportUnexpectedAuthError is a no-op logger here.
vi.mock("@agentic-toolkit/auth", () => ({
  useAuth: () => ({ user: { name: "Ada Lovelace" } }),
  reportUnexpectedAuthError: vi.fn(),
}));

vi.mock("@agentic-toolkit/data/markdown", () => ({
  markdownApi: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    categories: vi.fn(),
    tags: vi.fn(),
  },
}));

import { getToolkitQueryClient } from "@agentic-toolkit/data/query";
import { ResearchFeature } from "./ResearchFeature";
import { markdownApi, type ResearchDocument, type ResearchSummary } from "@agentic-toolkit/data/markdown";

const list = vi.mocked(markdownApi.list);
const get = vi.mocked(markdownApi.get);
const create = vi.mocked(markdownApi.create);
const update = vi.mocked(markdownApi.update);
const categories = vi.mocked(markdownApi.categories);
const tags = vi.mocked(markdownApi.tags);

const SUMMARY: ResearchSummary = {
  id: "doc-1",
  title: "Federated learning notes",
  category: "ml",
  tags: ["notes"],
  visibility: "private",
  publicRoute: null,
};

const DOCUMENT: ResearchDocument = {
  id: "doc-1",
  title: "Federated learning notes",
  content: "# Federated learning\n\nSome notes.",
  category: "ml",
  tags: ["notes"],
  visibility: "private",
  publicRoute: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  list.mockResolvedValue([structuredClone(SUMMARY)]);
  get.mockResolvedValue(structuredClone(DOCUMENT));
  create.mockResolvedValue(structuredClone(DOCUMENT));
  categories.mockResolvedValue([]);
  tags.mockResolvedValue([]);
});

// Explicit and redundant, deliberately: this package's vitest runs with `globals: true`
// (packages/web/packages/features/vitest.preset.ts:16), so RTL 16.3.2's own shipped
// `afterEach(cleanup)` DOES register (@testing-library/react/dist/index.js:23-30), and cleanup
// is idempotent. An earlier version of this comment asserted the opposite — no global afterEach,
// auto-cleanup never registers — and both halves were false. Keep the call if you like it as a
// local statement of intent; do not "fix" the config to match the claim that was here.
afterEach(cleanup);

// The cache a document is re-opened FROM is emptied between tests by the package's `vitest-setup`
// teardown — without it a document a previous test opened is still cached and still fresh, so the
// next test's `get` is never called and its assertion fails describing the feature working
// correctly. The tests below therefore each start from an empty cache.

/** Renders the published rail level (the document rows) the way the hub's workspace shell would,
 *  so the test can drive the rows. It draws NO create button and NO filter slot: those are the
 *  page's controls now and reach the home bar instead, so a rail stub that still rendered
 *  `l.onNew`/`l.railSlot` would quietly keep a regression to the old arrangement passing.
 *
 *  It also stands in for the two signals the real `TopicRail` owns: the header spinner it shows
 *  while `busy`, and the hover dwell after which it calls `onPrefetch`. The dwell's TIMING is the
 *  rail's own business (and is tested there); what belongs here is whether this pane wires the
 *  two at all — which is exactly the thing a typechecked optional prop cannot tell you. */
function Rail({ levels }: { levels: TopicLevel[] }) {
  return (
    <div>
      {levels.map((l) => (
        <div key={l.id}>
          {l.busy && <span data-testid={`busy-${l.id}`} />}
          <ul>
            {l.items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => l.onSelect?.(item.id)}
                  onPointerEnter={() => l.onPrefetch?.(item.id)}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** A minimal rail HOST: it registers ResearchPane's published documents level and exposes the
 *  merged stack the way the hub's workspace shell would (the shell owns `mergedLevels`; this
 *  package owns only the RailHostContext contract), plus a real {@link HomeBarHost} above both —
 *  the two hosts SiteHomeShell / the hub shell mount around this feature. Stands in for them so
 *  the published document rows AND the home bar's own controls are drivable. */
function Harness({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<Map<string, RegisteredLevels>>(new Map());
  const registry: RailHostRegistry = useMemo(
    () => ({
      registerLevels: (id, entry) =>
        setEntries((m) => {
          const next = new Map(m);
          next.set(id, entry);
          return next;
        }),
      unregisterLevels: (id) =>
        setEntries((m) => {
          const next = new Map(m);
          next.delete(id);
          return next;
        }),
      registerExitGuard: () => {},
      popStack: () => {},
      reportMissing: () => {},
      reportBusy: () => {},
      toolbarSlot: null,
    }),
    [],
  );
  const mergedLevels = [...entries.values()]
    .sort((a, b) => a.depth - b.depth)
    .flatMap((e) => e.levels);
  return (
    <RailHostContext.Provider value={registry}>
      <HomeBarHost>
        <Rail levels={mergedLevels} />
        {children}
      </HomeBarHost>
    </RailHostContext.Provider>
  );
}

describe("ResearchFeature", () => {
  it("publishes the documents list from markdownApi.list", async () => {
    render(
      <Harness>
        <ResearchFeature basePath="/w1/research" />
      </Harness>,
    );

    expect(await screen.findByText("Federated learning notes")).not.toBeNull();
    expect(list).toHaveBeenCalled();
  });

  it("creates a document through the home bar's New document button", async () => {
    render(
      <Harness>
        <ResearchFeature basePath="/w1/research" />
      </Harness>,
    );

    // Clicked THROUGH the strip, not through `screen`: this is the button the user now has, and
    // driving it from inside `home-bar` is also what proves the portal keeps its children in this
    // component's REACT tree — a button that left the DOM subtree but still closes over
    // `setNewOpen`. It opens the CREATE MODAL (HTD `must-create-in-modal`): the body, plus the
    // category that places it. The body is asked for here rather than left to the editor because
    // it is now the document's NAME — the title is its first line — so an empty create would mint
    // an "Untitled" row the user then has to go and find.
    const strip = within(await screen.findByTestId("home-bar"));
    fireEvent.click(strip.getByRole("button", { name: "New document" }));

    // Scope to the dialog: the editor's portaled action bar has its own Save button.
    const dialog = within(screen.getByRole("dialog", { name: "New document" }));
    // Anchored regex, not the bare string: `Field` renders the hint INSIDE the <label>, so the
    // accessible name is "Body The first line becomes the document's title."
    fireEvent.change(dialog.getByLabelText(/^Body/), {
      target: { value: "# Hello research\n\nFirst pass." },
    });
    fireEvent.click(dialog.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(
        // A blank category and an empty tag list are omitted from the create body. No title is
        // sent at all — the backend derives it from the first line.
        { content: "# Hello research\n\nFirst pass." },
        // No workspaceSlug prop in this harness → creator-owned (workspace undefined).
        { workspace: undefined },
      ),
    );
  });

  it("opens the selected document (deep link via docId) with its body loaded", async () => {
    render(
      <Harness>
        <ResearchFeature basePath="/w1/research" docId="doc-1" />
      </Harness>,
    );

    // The body is the only editable text: there is no Title input to assert, by design — the
    // title shown in the rail is derived from this field's first line.
    const body = (await screen.findByLabelText("Markdown body")) as HTMLTextAreaElement;
    await waitFor(() => expect(body.value).toBe("# Federated learning\n\nSome notes."));
    expect(screen.queryByLabelText("Title")).toBeNull();
    await waitFor(() => expect(get).toHaveBeenCalledWith("doc-1", { workspace: undefined }));
  });

  // `canSave` is dirty && valid — the busy term is applied at the button (SaveCancelButtons
  // renders `disabled={!canSave || saving}`), never folded into the predicate. `saving` is a
  // RENDER value, so it cannot also serve as the in-flight guard: two activations inside a
  // single commit (a double-click before React paints the disabled button) both read the
  // pre-save `false` and both PUT. Only the handler's own ref stops the second.
  it("ignores a second Save that lands before the disabled state can render", async () => {
    update.mockReturnValue(new Promise(() => {})); // never settles — the save stays in flight
    render(
      <Harness>
        <ResearchFeature basePath="/w1/research" docId="doc-1" />
      </Harness>,
    );

    const body = (await screen.findByLabelText("Markdown body")) as HTMLTextAreaElement;
    await waitFor(() => expect(body.value).toBe("# Federated learning\n\nSome notes."));
    fireEvent.change(body, { target: { value: "# Federated learning v2\n\nSome notes." } });

    const save = screen.getByRole("button", { name: "Save" });
    await act(async () => {
      save.click();
      save.click();
    });

    expect(update).toHaveBeenCalledTimes(1);
  });

  // The counterpart to the guard above: that ref is released in `finally`, so it also releases
  // when the PUT throws. Nothing pinned that — move the reset onto the success path and one 500
  // leaves `savingRef.current === true` for the rest of the session, with Save silently dead and
  // nothing on screen saying why.
  it("releases the in-flight latch when the save THROWS, so a retry still fires", async () => {
    update
      .mockRejectedValueOnce(new Error("Backend exploded."))
      .mockResolvedValueOnce(structuredClone({ ...DOCUMENT, title: "Federated learning v2" }));
    render(
      <Harness>
        <ResearchFeature basePath="/w1/research" docId="doc-1" />
      </Harness>,
    );

    const body = (await screen.findByLabelText("Markdown body")) as HTMLTextAreaElement;
    await waitFor(() => expect(body.value).toBe("# Federated learning\n\nSome notes."));
    fireEvent.change(body, { target: { value: "# Federated learning v2\n\nSome notes." } });

    const save = screen.getByRole("button", { name: "Save" });
    await act(async () => {
      save.click();
    });
    expect(update).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Backend exploded.")).not.toBeNull();

    // The draft is untouched by the failure, so Save is live again — and it must actually fire.
    const retry = screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;
    expect(retry.disabled).toBe(false);
    await act(async () => {
      retry.click();
    });
    expect(update).toHaveBeenCalledTimes(2);
  });

  // ── Two bases (docBasePath) ────────────────────────────────────────────────────
  // The research SITE splits `basePath` (list) from `docBasePath` (open document) — see this
  // component's own doc comment. Every test above passes only `basePath`, exercising just the
  // default (docBasePath === basePath) path; these two are the only coverage of the split, so a
  // regression that swapped the two bases, or fell back to `basePath` for both, would pass every
  // other test in this file.

  it("routes a selected document under docBasePath, not basePath", async () => {
    render(
      <Harness>
        <ResearchFeature basePath="/acme/home" docBasePath="/acme/edit" />
      </Harness>,
    );

    const row = await screen.findByRole("button", { name: "Federated learning notes" });
    fireEvent.click(row);

    expect(push).toHaveBeenCalledWith("/acme/edit/doc-1", { scroll: false });
  });

  it("closing an open document (Cancel) returns to basePath, not docBasePath", async () => {
    render(
      <Harness>
        <ResearchFeature basePath="/acme/home" docBasePath="/acme/edit" docId="doc-1" />
      </Harness>,
    );

    const body = (await screen.findByLabelText("Markdown body")) as HTMLTextAreaElement;
    await waitFor(() => expect(body.value).toBe("# Federated learning\n\nSome notes."));

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(push).toHaveBeenCalledWith("/acme/home", { scroll: false });
  });

  // ── The cache ────────────────────────────────────────────────────────────────
  // The complaint these exist for: "each time I click a topic we fetch the contents from the
  // database, this makes the site feel super slow." Each test below asserts a read that does NOT
  // happen — which is the only way to state the fix, since a document painted from the cache and
  // one painted from a fresh GET look identical on screen.

  it("paints a re-opened document from the cache instead of reading it again", async () => {
    render(
      <Harness>
        <ResearchFeature basePath="/w1/research" docId="doc-1" />
      </Harness>,
    );
    const first = (await screen.findByLabelText("Markdown body")) as HTMLTextAreaElement;
    await waitFor(() => expect(first.value).toBe("# Federated learning\n\nSome notes."));
    expect(get).toHaveBeenCalledTimes(1);
    cleanup();

    render(
      <Harness>
        <ResearchFeature basePath="/w1/research" docId="doc-1" />
      </Harness>,
    );
    // Synchronous `get…`, not `findBy…`: there is nothing to wait for. The body is on the FIRST
    // paint, and awaiting here would hide the difference between that and a fast refetch.
    const again = screen.getByLabelText("Markdown body") as HTMLTextAreaElement;
    expect(again.value).toBe("# Federated learning\n\nSome notes.");
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("warms a hovered row's body, so the click that follows reads nothing", async () => {
    render(
      <Harness>
        <ResearchFeature basePath="/w1/research" />
      </Harness>,
    );
    const row = await screen.findByRole("button", { name: "Federated learning notes" });
    await act(async () => {
      fireEvent.pointerEnter(row);
    });
    expect(get).toHaveBeenCalledWith("doc-1", { workspace: undefined });
    cleanup();

    render(
      <Harness>
        <ResearchFeature basePath="/w1/research" docId="doc-1" />
      </Harness>,
    );
    const body = screen.getByLabelText("Markdown body") as HTMLTextAreaElement;
    expect(body.value).toBe("# Federated learning\n\nSome notes.");
    // The warm, and nothing since — the click spent no request of its own.
    expect(get).toHaveBeenCalledTimes(1);
  });

  // The instant paint is only safe because of this: a cached copy may be out of date, so the form
  // is READ-ONLY until the server's answer lands. Editing a stale copy and saving it would put
  // fields back that the server has since changed, and nothing on screen would say so.
  it("paints the cached body immediately but keeps it read-only until the server answers", async () => {
    render(
      <Harness>
        <ResearchFeature basePath="/w1/research" docId="doc-1" />
      </Harness>,
    );
    const settled = (await screen.findByLabelText("Markdown body")) as HTMLTextAreaElement;
    await waitFor(() => expect(settled.value).toBe("# Federated learning\n\nSome notes."));
    expect(settled.disabled).toBe(false);
    cleanup();

    // Hold the next read open, then mark the entry stale so the remount revalidates. That window —
    // cached copy on screen, server's answer still in flight — is what the assertions below are.
    get.mockReturnValue(new Promise<ResearchDocument>(() => {}));
    await act(async () => {
      await getToolkitQueryClient().invalidateQueries();
    });

    render(
      <Harness>
        <ResearchFeature basePath="/w1/research" docId="doc-1" />
      </Harness>,
    );
    const body = screen.getByLabelText("Markdown body") as HTMLTextAreaElement;
    expect(body.value).toBe("# Federated learning\n\nSome notes.");
    expect(body.disabled).toBe(true);
    // And the one thing that tells the user why: the spinner in front of the list's title.
    expect(screen.getByTestId("busy-research-documents")).not.toBeNull();
  });

  // The loader this pane used to own cleared the form error on every selection change. Nothing
  // pinned that, and the cache refactor deleted the loader — so without this the message from a
  // failed save on one document greets the user on the next one, attached to a document that
  // never failed.
  it("leaves a failed save's message behind when another document is opened", async () => {
    update.mockRejectedValueOnce(new Error("Backend exploded."));
    get.mockImplementation(async (id) => ({
      ...structuredClone(DOCUMENT),
      id,
      content: `# ${id}\n\nBody.`,
    }));
    const { rerender } = render(
      <Harness>
        <ResearchFeature basePath="/w1/research" docId="doc-1" />
      </Harness>,
    );
    const body = (await screen.findByLabelText("Markdown body")) as HTMLTextAreaElement;
    await waitFor(() => expect(body.value).toBe("# doc-1\n\nBody."));
    fireEvent.change(body, { target: { value: "# doc-1 v2\n\nBody." } });
    await act(async () => {
      screen.getByRole("button", { name: "Save" }).click();
    });
    expect(await screen.findByText("Backend exploded.")).not.toBeNull();

    // Same mount, new selection — how Back, a deep link and a rail click all arrive.
    rerender(
      <Harness>
        <ResearchFeature basePath="/w1/research" docId="doc-2" />
      </Harness>,
    );
    await waitFor(() =>
      expect((screen.getByLabelText("Markdown body") as HTMLTextAreaElement).value).toBe(
        "# doc-2\n\nBody.",
      ),
    );
    expect(screen.queryByText("Backend exploded.")).toBeNull();
  });

  it("paints the document list from cache on a remount, reading it once", async () => {
    render(
      <Harness>
        <ResearchFeature basePath="/w1/research" />
      </Harness>,
    );
    expect(await screen.findByText("Federated learning notes")).not.toBeNull();
    // Two reads, not one: the filtered list, and the unfiltered universe behind the filter
    // dropdowns. They are separate keys because they answer separate questions.
    expect(list).toHaveBeenCalledTimes(2);
    cleanup();

    // Synchronous, like the document assertions above: the rows are on the FIRST paint.
    render(
      <Harness>
        <ResearchFeature basePath="/w1/research" />
      </Harness>,
    );
    expect(screen.getByText("Federated learning notes")).not.toBeNull();
    expect(list).toHaveBeenCalledTimes(2);
  });

  // The debounce moved: it used to delay the REQUEST, and now delays the query KEY. Same 200ms of
  // typing without a read — and, unlike a debounced request, the value typed away from and back to
  // is a repaint rather than a round trip.
  it("spends one read on a settled search, and none on going back to it", async () => {
    // A search answers with nothing, so the rows themselves say which key is on screen.
    list.mockImplementation(async (f) => (f?.q ? [] : [structuredClone(SUMMARY)]));
    render(
      <Harness>
        <ResearchFeature basePath="/w1/research" />
      </Harness>,
    );
    expect(await screen.findByText("Federated learning notes")).not.toBeNull();
    expect(list).toHaveBeenCalledTimes(2);

    const search = screen.getByLabelText("Search research documents");
    fireEvent.change(search, { target: { value: "f" } });
    fireEvent.change(search, { target: { value: "fe" } });
    fireEvent.change(search, { target: { value: "fed" } });
    await waitFor(() => expect(screen.queryByText("Federated learning notes")).toBeNull());
    // ONE read for three keystrokes, and it is the value the user stopped at.
    expect(list).toHaveBeenCalledTimes(3);
    expect(list).toHaveBeenLastCalledWith(
      { q: "fed", category: "", tag: "" },
      { workspace: undefined },
    );

    fireEvent.change(search, { target: { value: "" } });
    await waitFor(() => expect(screen.getByText("Federated learning notes")).not.toBeNull());
    // The unfiltered rows came back from the cache: the key returned to one already read.
    expect(list).toHaveBeenCalledTimes(3);
  });

  it("opens a created document from the create response, with no read at all", async () => {
    render(
      <Harness>
        <ResearchFeature basePath="/w1/research" />
      </Harness>,
    );
    fireEvent.click(await screen.findByRole("button", { name: "New document" }));
    const dialog = within(await screen.findByRole("dialog"));
    fireEvent.change(dialog.getByLabelText(/^Body/), {
      target: { value: "# Hello research\n\nFirst pass." },
    });
    await act(async () => {
      fireEvent.click(dialog.getByRole("button", { name: "Save" }));
    });
    await waitFor(() => expect(create).toHaveBeenCalled());
    cleanup();

    // The create response IS the server's copy, so opening what was just created costs nothing.
    // (The mocked router can't advance the URL in this harness, so the open is a fresh mount at
    // the created id — which is also what a reload or a shared link does.)
    render(
      <Harness>
        <ResearchFeature basePath="/w1/research" docId="doc-1" />
      </Harness>,
    );
    const body = screen.getByLabelText("Markdown body") as HTMLTextAreaElement;
    expect(body.value).toBe("# Federated learning\n\nSome notes.");
    expect(get).not.toHaveBeenCalled();
  });

  // ── The home bar ─────────────────────────────────────────────
  // Both of this pane's page-level controls moved OUT of the rail level's header and INTO the home
  // bar. Every query below goes through `within(home-bar)` rather than `screen`, which is the only
  // thing that makes these tests capable of failing: `HomeBarPortal` renders inline when no
  // `HomeBarHost` is above it, so a bare `screen.getByRole("button", { name: "New document" })`
  // finds the button whether it was published into the strip or left where it was.

  it("publishes the filters and New document INTO the home bar, filters before the button", async () => {
    render(
      <Harness>
        <ResearchFeature basePath="/w1/research" />
      </Harness>,
    );

    const strip = await screen.findByTestId("home-bar");
    const bar = within(strip);
    const search = bar.getByRole("searchbox", { name: "Search research documents" });
    const create = bar.getByRole("button", { name: "New document" });
    // The whole filter cluster, not just the search field: `railSlot` carried all three axes, so
    // all three have to arrive.
    bar.getByRole("combobox", { name: "Filter by category" });
    bar.getByRole("combobox", { name: "Filter by tag" });

    // The fleet's placement rule — filters left, primary action right — which "both are present"
    // cannot see. MASKED, not `toBe(4)`: `compareDocumentPosition` returns a BITMASK, and the
    // FOLLOWING bit arrives OR-ed with others (CONTAINED_BY, IMPLEMENTATION_SPECIFIC) depending on
    // the nesting, so an equality assertion on it passes or fails for reasons unrelated to order.
    expect(search.compareDocumentPosition(create) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // And nowhere ELSE. A control published into the bar but ALSO still handed to the rail as
    // `onNew`/`railSlot` would satisfy every assertion above; only counting the whole document
    // catches it.
    expect(screen.getAllByRole("button", { name: "New document" })).toHaveLength(1);
    expect(screen.getAllByRole("searchbox")).toHaveLength(1);
  });

  it("still publishes the bar with ZERO documents — the first create is when it matters most", async () => {
    // An empty list, and the create must survive it: gating the bar on having something to list is
    // precisely the trap this branch exists to close (a brand-new tenant with no way to create
    // anything at all). The unfiltered universe read is empty here too, so the category/tag
    // dropdowns hold only their all-pass entries — the search field is what has to be there.
    list.mockResolvedValue([]);
    render(
      <Harness>
        <ResearchFeature basePath="/w1/research" />
      </Harness>,
    );

    const bar = within(await screen.findByTestId("home-bar"));
    expect(bar.getByRole("button", { name: "New document" })).not.toBeNull();
    expect(bar.getByRole("searchbox", { name: "Search research documents" })).not.toBeNull();
  });

  it("filters the list from the home bar's search field", async () => {
    // The publish is a PORTAL, not a move: the field left this pane's DOM subtree but still sits in
    // its React tree, so typing in the strip must still drive the pane's `filters` state and reach
    // the list request. A field that rendered in the bar but no longer fed the list would pass
    // every placement assertion above.
    list.mockImplementation(async (f) => (f?.q ? [] : [structuredClone(SUMMARY)]));
    render(
      <Harness>
        <ResearchFeature basePath="/w1/research" />
      </Harness>,
    );
    expect(await screen.findByText("Federated learning notes")).not.toBeNull();

    const bar = within(await screen.findByTestId("home-bar"));
    fireEvent.change(bar.getByRole("searchbox", { name: "Search research documents" }), {
      target: { value: "fed" },
    });
    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith(
        { q: "fed", category: "", tag: "" },
        { workspace: undefined },
      ),
    );
    await waitFor(() => expect(screen.queryByText("Federated learning notes")).toBeNull());
  });
});
