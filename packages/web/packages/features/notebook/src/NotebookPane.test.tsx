// @vitest-environment jsdom
//
// Component test for NotebookPane — the notes workspace. Only the two data domain boundaries
// (@agentic-toolkit/data/notes, .../ecosystems) and @agentic-toolkit/auth's telemetry are
// mocked, so the level-publish → filter → create → save wiring is exercised, not the transport.
//
// The pane PUBLISHES its lists as rail levels rather than rendering them, and publishes the
// button bar into the host's feature-bar slot. The harness below stands in for that host twice
// over: it renders the published levels (so their rows are clickable) and it hands the test the
// level OBJECTS, because half of what this change is about is which affordances a level no
// longer carries — and an absent `+` has no DOM to assert on.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useMemo, useState, type ReactNode } from "react";
import {
  RailHostContext,
  type RailHostRegistry,
  type RegisteredLevels,
} from "@agentic-toolkit/resource";
import type { TopicLevel } from "@agentic-toolkit/ui/blocks";

vi.mock("@agentic-toolkit/auth", () => ({
  useAuth: () => ({ user: { name: "Ada Lovelace" } }),
  reportUnexpectedAuthError: vi.fn(),
}));

vi.mock("@agentic-toolkit/data/ecosystems", () => ({
  ecosystemsApi: { list: vi.fn(), listForWorkspace: vi.fn() },
}));

vi.mock("@agentic-toolkit/data/notes", () => ({
  notesApi: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    categories: vi.fn(),
    tagSet: vi.fn(),
    createCategory: vi.fn(),
  },
  taxonomyApi: {
    renameCategory: vi.fn(),
    reparentCategory: vi.fn(),
    deleteCategory: vi.fn(),
    renameTag: vi.fn(),
    deleteTag: vi.fn(),
  },
}));

import { NotebookPane } from "./NotebookPane";
import { ecosystemsApi, type Ecosystem } from "@agentic-toolkit/data/ecosystems";
import {
  notesApi,
  taxonomyApi,
  type Note,
  type NoteCategory,
  type NoteSummary,
} from "@agentic-toolkit/data/notes";

const list = vi.mocked(notesApi.list);
const get = vi.mocked(notesApi.get);
const create = vi.mocked(notesApi.create);
const update = vi.mocked(notesApi.update);
const categories = vi.mocked(notesApi.categories);
const tagSet = vi.mocked(notesApi.tagSet);
const listForWorkspace = vi.mocked(ecosystemsApi.listForWorkspace);
const renameTag = vi.mocked(taxonomyApi.renameTag);

const SUMMARY: NoteSummary = {
  id: "note-1",
  title: "Standup",
  excerpt: "Discussed the migration and the rollout order.",
  category: "Work",
  tags: ["meeting"],
  visibility: "private",
  publicRoute: null,
};

const NOTE: Note = {
  id: "note-1",
  title: "Standup",
  content: "# Standup\n\nDiscussed the migration.",
  category: "Work",
  tags: ["meeting"],
  visibility: "private",
  publicRoute: null,
};

/** A note written before a body was required — the shape the reported Save bug lives in. */
const EMPTY_NOTE: Note = { ...NOTE, id: "note-2", title: "Untitled", content: "" };

const WORK: NoteCategory = { id: "cat-1", name: "Work", parentId: null, sortOrder: 0 };
const PERSONAL: NoteCategory = { id: "cat-2", name: "Personal", parentId: null, sortOrder: 1 };

const ECOSYSTEM: Ecosystem = {
  id: "eco-1",
  identifier: "core",
  name: "Core",
  description: "",
  region: "us",
  domain: "example.com",
  createdAt: "",
  updatedAt: "",
};

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  list.mockResolvedValue([structuredClone(SUMMARY)]);
  get.mockResolvedValue(structuredClone(NOTE));
  create.mockResolvedValue(structuredClone(NOTE));
  update.mockResolvedValue(structuredClone(NOTE));
  categories.mockResolvedValue([structuredClone(WORK)]);
  // Two tags, one of them NOT on the fixture note: the tag row commits on an exact vocabulary
  // match, so a second label is what makes "add a tag" expressible at all.
  tagSet.mockResolvedValue([
    { id: "kw-1", label: "meeting" },
    { id: "kw-2", label: "retro" },
  ]);
  listForWorkspace.mockResolvedValue([structuredClone(ECOSYSTEM)]);
});

afterEach(cleanup);

/** The merged stack, captured per render so a test can assert on a level's SHAPE. */
let levels: TopicLevel[] = [];

function levelById(id: string): TopicLevel {
  const hit = levels.find((l) => l.id.startsWith(id));
  if (!hit) throw new Error(`no published level starting with ${id}: ${levels.map((l) => l.id)}`);
  return hit;
}

/** Renders the published rows the way the hub's workspace shell would. */
function Rail({ published }: { published: TopicLevel[] }) {
  return (
    <div>
      {published.map((l) => (
        <div key={l.id}>
          <h3>{l.title}</h3>
          {l.onNew && (
            <button type="button" onClick={() => l.onNew?.()}>
              {l.newLabel}
            </button>
          )}
          {l.titleActions}
          <ul>
            {l.items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  disabled={item.disabled}
                  onClick={() => l.onSelect?.(item.id)}
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

/** A minimal rail host. `claimFeatureBar`/`featureBarSlot` are deliberately absent, which is
 *  the degrade path `FeatureBarPortal` documents: with no host slot the bar renders inline, so
 *  the same test can drive it. */
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
  levels = [...entries.values()].sort((a, b) => a.depth - b.depth).flatMap((e) => e.levels);
  return (
    <RailHostContext.Provider value={registry}>
      <Rail published={levels} />
      {children}
    </RailHostContext.Provider>
  );
}

function renderPane(props: { categorySlugs?: string[]; noteId?: string } = {}) {
  const onSelectCategory = vi.fn();
  const onSelectNote = vi.fn();
  render(
    <Harness>
      <NotebookPane
        categorySlugs={props.categorySlugs ?? []}
        noteId={props.noteId}
        onSelectCategory={onSelectCategory}
        onSelectNote={onSelectNote}
        workspaceSlug="acme"
      />
    </Harness>,
  );
  return { onSelectCategory, onSelectNote };
}

describe("the rail", () => {
  it("leads with the workspace's ecosystems, read-only", async () => {
    renderPane();

    expect(await screen.findByRole("button", { name: "Core" })).not.toBeNull();
    const level = levelById("notebook-ecosystems");
    // Read-only is three absences and one presence: nothing creates, nothing is selected, and
    // every row is dimmed rather than looking clickable and doing nothing.
    expect(level.onNew).toBeUndefined();
    expect(level.selectedId).toBeNull();
    expect(level.items.every((i) => i.disabled)).toBe(true);
    expect(listForWorkspace).toHaveBeenCalledWith("acme");
  });

  it("no longer offers a `+` on the categories or the notes level", async () => {
    renderPane();
    await screen.findByRole("button", { name: "Standup" });

    // Both creates moved to the button bar / the category editor, so the rail headers hold
    // nothing but navigation and the notes level's display gear.
    expect(levelById("notebook-categories").onNew).toBeUndefined();
    expect(levelById("notebook-notes").onNew).toBeUndefined();
    expect(levelById("notebook-notes").titleActions).not.toBeUndefined();
  });

  it("prepends All and Uncategorized to the root category list", async () => {
    renderPane();
    await screen.findByRole("button", { name: "Work" });

    const level = levelById("notebook-categories");
    expect(level.items.map((i) => i.label)).toEqual(["All", "Uncategorized", "Work"]);
    // Nothing selected means the whole notebook, which is what All names.
    expect(level.selectedId).toBe("-all");
  });

  it("navigates All to the bare notebook and Uncategorized to its reserved slug", async () => {
    const { onSelectCategory } = renderPane({ categorySlugs: ["work"] });
    await screen.findByRole("button", { name: "Work" });

    fireEvent.click(screen.getByRole("button", { name: "Uncategorized" }));
    expect(onSelectCategory).toHaveBeenLastCalledWith(["-none"]);

    fireEvent.click(screen.getByRole("button", { name: "All" }));
    // "All" is the ABSENCE of a category, which the URL grammar already spells as no segments.
    expect(onSelectCategory).toHaveBeenLastCalledWith([]);
  });

  it("shows only uncategorized notes on the Uncategorized row, filtered client-side", async () => {
    list.mockResolvedValue([
      structuredClone(SUMMARY),
      { ...structuredClone(SUMMARY), id: "note-3", title: "Loose thought", category: null },
    ]);
    renderPane({ categorySlugs: ["-none"] });

    expect(await screen.findByRole("button", { name: "Loose thought" })).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Standup" })).toBeNull();
    // The backend has no "no category" parameter — a blank one means "don't filter" — so the
    // request must NOT carry one, and the narrowing has to happen here.
    expect(list).toHaveBeenCalledWith({ q: "", tag: "", category: "" }, { workspace: "acme" });
  });
});

describe("the button bar", () => {
  it("searches, and filters by category and tag", async () => {
    renderPane();
    await screen.findByRole("button", { name: "Standup" });

    fireEvent.change(screen.getByLabelText("Search notes"), { target: { value: "migration" } });
    fireEvent.change(screen.getByLabelText("Filter by category"), { target: { value: "Work" } });
    fireEvent.change(screen.getByLabelText("Filter by tag"), { target: { value: "meeting" } });

    await waitFor(() =>
      expect(list).toHaveBeenLastCalledWith(
        { q: "migration", tag: "meeting", category: "Work" },
        { workspace: "acme" },
      ),
    );
  });

  it("asks for nothing when the rail and the filter name different categories", async () => {
    categories.mockResolvedValue([structuredClone(WORK), structuredClone(PERSONAL)]);
    renderPane({ categorySlugs: ["work"] });
    await screen.findByRole("button", { name: "Standup" });
    const before = list.mock.calls.length;

    fireEvent.change(screen.getByLabelText("Filter by category"), {
      target: { value: "Personal" },
    });

    // A note has one category, so the intersection is empty — and an empty answer needs no
    // request. The list has to actually empty out, not keep showing the pre-filter rows.
    await waitFor(() => expect(screen.queryByRole("button", { name: "Standup" })).toBeNull());
    expect(list.mock.calls.length).toBe(before);
  });

  it("opens the tag editor, which renames by id", async () => {
    renderPane();
    await screen.findByRole("button", { name: "Standup" });

    fireEvent.click(screen.getByRole("button", { name: "Edit tags" }));
    const field = await screen.findByLabelText("Name of tag meeting");
    fireEvent.change(field, { target: { value: "standup" } });
    fireEvent.keyDown(field, { key: "Enter" });

    // By id, never by label: `content.keyword_items` links to the row, so the rename carries
    // every note wearing it.
    await waitFor(() => expect(renameTag).toHaveBeenCalledWith("kw-1", "standup"));
  });
});

describe("creating a note", () => {
  it("asks for the body, category and tags — and no title", async () => {
    renderPane();
    await screen.findByRole("button", { name: "Standup" });

    fireEvent.click(screen.getByRole("button", { name: "Create Note" }));
    const dialog = within(await screen.findByRole("dialog", { name: "New note" }));

    // The title is the body's first line, derived by the backend, so there is nothing to type.
    expect(dialog.queryByLabelText("Title")).toBeNull();
    fireEvent.change(dialog.getByLabelText("Note"), {
      target: { value: "# Retro\n\nWhat went well." },
    });
    await act(async () => {
      dialog.getByRole("button", { name: "Save" }).click();
    });

    expect(create).toHaveBeenCalledWith(
      { content: "# Retro\n\nWhat went well." },
      { workspace: "acme" },
    );
  });

  it("refuses an empty body, so no note is minted that can never be saved again", async () => {
    renderPane();
    await screen.findByRole("button", { name: "Standup" });

    fireEvent.click(screen.getByRole("button", { name: "Create Note" }));
    const dialog = within(await screen.findByRole("dialog", { name: "New note" }));
    // Adding only a tag makes the draft dirty — Save goes live — but the create still has to
    // refuse, and say why rather than failing at the backend with a shape error.
    fireEvent.change(dialog.getByLabelText("Add a tag"), { target: { value: "retro" } });
    await act(async () => {
      dialog.getByRole("button", { name: "Save" }).click();
    });

    expect(dialog.getByText("A note body is required.")).not.toBeNull();
    expect(create).not.toHaveBeenCalled();
  });
});

describe("the Save button", () => {
  it("enables when a tag is added to an open note", async () => {
    // The reported defect, at its simplest: adding classification IS an edit.
    renderPane({ noteId: "note-1" });
    await waitFor(() => expect(get).toHaveBeenCalledWith("note-1", { workspace: "acme" }));

    const save = (await screen.findByRole("button", { name: "Save" })) as HTMLButtonElement;
    expect(save.disabled).toBe(true);

    fireEvent.change(await screen.findByLabelText("Add a tag"), { target: { value: "retro" } });

    await waitFor(() => expect(save.disabled).toBe(false));
    await act(async () => {
      save.click();
    });
    expect(update).toHaveBeenCalledWith(
      "note-1",
      expect.objectContaining({ tags: ["meeting", "retro"] }),
      { workspace: "acme" },
    );
  });

  it("says WHY it is disabled on a note that has no body", async () => {
    // The other half of the same report: a note written before a body was required opens
    // invalid and untouched, so Save is grey no matter what is edited. The reason is on the
    // field from the first render — gating it on `dirty` is what hid it.
    get.mockResolvedValue(structuredClone(EMPTY_NOTE));
    renderPane({ noteId: "note-2" });

    expect(await screen.findByText("A note body is required.")).not.toBeNull();
    const save = (await screen.findByRole("button", { name: "Save" })) as HTMLButtonElement;

    fireEvent.change(await screen.findByLabelText("Add a tag"), { target: { value: "retro" } });
    await waitFor(() => expect(screen.getByLabelText("Remove retro")).not.toBeNull());
    expect(save.disabled).toBe(true);

    // Writing the body clears the blocker, and only then does Save come alive.
    fireEvent.change(screen.getByLabelText("Note"), { target: { value: "# Retro" } });
    await waitFor(() => expect(save.disabled).toBe(false));
  });

  it("flags the blocked note's own row while it cannot be saved", async () => {
    get.mockResolvedValue(structuredClone(EMPTY_NOTE));
    list.mockResolvedValue([
      structuredClone(SUMMARY),
      { ...structuredClone(SUMMARY), id: "note-2", title: "Untitled" },
    ]);
    renderPane({ noteId: "note-2" });

    // The row is where the user is looking when they wonder why Save is grey.
    await waitFor(() =>
      expect(levelById("notebook-notes").items.find((i) => i.id === "note-2")?.blocked).toBe(true),
    );
    expect(levelById("notebook-notes").items.find((i) => i.id === "note-1")?.blocked).toBe(false);
  });
});

describe("the notes list options", () => {
  it("carries each note's excerpt, clamped to the stored preview-line count", async () => {
    window.localStorage.setItem("apt:notebook:preview-lines", "3");
    renderPane();
    await screen.findByRole("button", { name: "Standup" });

    const item = levelById("notebook-notes").items[0];
    expect(item.preview).toBe("Discussed the migration and the rollout order.");
    expect(item.previewLines).toBe(3);
  });

  it("drops the preview entirely at zero lines", async () => {
    window.localStorage.setItem("apt:notebook:preview-lines", "0");
    renderPane();
    await screen.findByRole("button", { name: "Standup" });

    // Not "render it with zero lines" — a preview nobody asked for should not be on the row at
    // all, so nothing can leak it through padding or a screen reader.
    expect(levelById("notebook-notes").items[0].preview).toBeUndefined();
  });
});
