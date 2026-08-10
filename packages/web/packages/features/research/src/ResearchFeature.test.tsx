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
// Rail) renders the published level's "New document" affordance AND its items, standing in for
// the hub's workspace shell.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, fireEvent, waitFor, within, cleanup } from "@testing-library/react";
import { useMemo, useState, type ReactNode } from "react";
import {
  RailHostContext,
  type RailHostRegistry,
  type RegisteredLevels,
} from "@agentic-toolkit/resource";
import type { TopicLevel } from "@agentic-toolkit/ui/blocks";

// useBasePathRoute (ResearchFeature's URL wiring) reads next/navigation's useRouter; a stub is
// enough since these tests assert on the API calls, not the resulting route.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
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

/** Renders the published rail affordances (the "New document" button + the document rows) the way
 *  the hub's workspace shell would, so the test can drive the shell-owned rail slot. */
function Rail({ levels }: { levels: TopicLevel[] }) {
  return (
    <div>
      {levels.map((l) => (
        <div key={l.id}>
          {l.onNew && (
            <button type="button" onClick={() => l.onNew?.()}>
              {l.newLabel}
            </button>
          )}
          <ul>
            {l.items.map((item) => (
              <li key={item.id}>
                <button type="button" onClick={() => l.onSelect?.(item.id)}>
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
 *  package owns only the RailHostContext contract). Stands in for the host so the published
 *  "New document" rail affordance and the document rows are drivable. */
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
      toolbarSlot: null,
    }),
    [],
  );
  const mergedLevels = [...entries.values()]
    .sort((a, b) => a.depth - b.depth)
    .flatMap((e) => e.levels);
  return (
    <RailHostContext.Provider value={registry}>
      <Rail levels={mergedLevels} />
      {children}
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

  it("creates a document through the New document rail affordance", async () => {
    render(
      <Harness>
        <ResearchFeature basePath="/w1/research" />
      </Harness>,
    );

    // The rail affordance opens the CREATE MODAL (HTD `must-create-in-modal`): the body, plus
    // the category that places it. The body is asked for here rather than left to the editor
    // because it is now the document's NAME — the title is its first line — so an empty create
    // would mint an "Untitled" row the user then has to go and find.
    fireEvent.click(await screen.findByRole("button", { name: "New document" }));

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
});
