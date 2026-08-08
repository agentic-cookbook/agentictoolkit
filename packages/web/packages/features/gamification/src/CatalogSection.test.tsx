// @vitest-environment jsdom
import { useState } from "react";
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { SettingsDirtyProvider, useSettingsDirty } from "@agentic-toolkit/resource";

vi.mock("@agentic-toolkit/auth", () => ({
  reportUnexpectedAuthError: vi.fn(),
}));

// SettingsDirtyProvider mounts its own UnsavedChangesGuard when no rail host is above it, and
// that guard passes onNavigate={(href) => router.push(href)}. There is no app-router context
// under vitest.
const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const { getCatalog, createRealmBadge, updateRealmBadge } = vi.hoisted(() => ({
  getCatalog: vi.fn(),
  createRealmBadge: vi.fn(),
  updateRealmBadge: vi.fn(),
}));
vi.mock("@agentic-toolkit/data/gamification", () => ({
  gamificationApi: {
    getCatalog,
    createRealmBadge,
    updateRealmBadge,
    deleteRealmBadge: vi.fn(),
    putRealmLevels: vi.fn(),
    replayRealm: vi.fn(),
  },
}));

import { CatalogSection } from "./CatalogSection";
import { RealmCatalogProvider } from "./realm-catalog";
import type { CatalogBadge } from "@agentic-toolkit/data/gamification";

afterEach(cleanup);

const EXISTING_BADGE: CatalogBadge = {
  id: "badge-1",
  source: "realm",
  name: "Trailblazer",
  description: "Awarded for blazing the trail.",
  icon: "🔥",
  statKey: "adventures",
  comparator: ">=",
  threshold: 10,
  badgeLine: "adventures",
  tier: "bronze",
  pointValue: 50,
  hidden: false,
} as CatalogBadge;

function saveOrAddButton(name: RegExp) {
  return screen.getByRole("button", { name }) as HTMLButtonElement;
}

async function renderEditor(badges: CatalogBadge[] = []) {
  getCatalog.mockResolvedValue({ badges, levels: [] });
  render(
    <RealmCatalogProvider ecosystemId="eco-1">
      <CatalogSection ecosystemId="eco-1" />
    </RealmCatalogProvider>,
  );
  await waitFor(() => expect(getCatalog).toHaveBeenCalled());
}
// NOTE: renderEditor resolves as soon as getCatalog has been CALLED — not once its
// promise has settled and the rows it feeds have rendered. Anything that comes from
// `badges` must therefore be reached with an awaited findBy*, never a synchronous
// getBy*: the sync form passes on an idle machine and fails under a loaded
// `pnpm -r run test`, which is exactly the flake this note exists to prevent.
// The "Add realm badge" trigger is safe with getBy — it renders unconditionally.

describe("CatalogSection badge dialog (add mode) — Save disabled at mount, enabled after a valid edit", () => {
  it("is disabled the moment the Add dialog opens (all fields blank)", async () => {
    await renderEditor();
    fireEvent.click(screen.getByRole("button", { name: "Add realm badge" }));
    expect(saveOrAddButton(/Add badge/).disabled).toBe(true);
  });

  it("stays disabled with only SOME required fields filled", async () => {
    await renderEditor();
    fireEvent.click(screen.getByRole("button", { name: "Add realm badge" }));
    fireEvent.change(screen.getByPlaceholderText("Trailblazer"), { target: { value: "New Badge" } });
    expect(saveOrAddButton(/Add badge/).disabled).toBe(true);
  });

  it("enables once every required field is filled with valid numbers", async () => {
    await renderEditor();
    fireEvent.click(screen.getByRole("button", { name: "Add realm badge" }));
    fireEvent.change(screen.getByPlaceholderText("Trailblazer"), { target: { value: "New Badge" } });
    fireEvent.change(screen.getByPlaceholderText("🔥"), { target: { value: "⭐" } });
    fireEvent.change(screen.getAllByPlaceholderText("adventures")[0]!, { target: { value: "quests" } });
    fireEvent.change(screen.getAllByPlaceholderText("adventures")[1]!, { target: { value: "questing" } });
    fireEvent.change(screen.getByPlaceholderText("10"), { target: { value: "5" } });
    fireEvent.change(screen.getByPlaceholderText("50"), { target: { value: "25" } });
    expect(saveOrAddButton(/Add badge/).disabled).toBe(false);
  });

  // `canSaveBadge` disables the button, so `submitBadge`'s own guards — and the messages they set
  // — are no longer reachable by clicking. The reason has to be rendered instead.
  it("says WHY Save is blocked while required fields are still missing", async () => {
    await renderEditor();
    fireEvent.click(screen.getByRole("button", { name: "Add realm badge" }));
    fireEvent.change(screen.getByPlaceholderText("Trailblazer"), { target: { value: "New Badge" } });
    expect(saveOrAddButton(/Add badge/).disabled).toBe(true);
    expect(screen.getByText("Name, icon, stat key, and badge line are required.")).toBeTruthy();
  });

  it("stays silent when the Add dialog first opens (grey only because nothing is dirty)", async () => {
    await renderEditor();
    fireEvent.click(screen.getByRole("button", { name: "Add realm badge" }));
    expect(saveOrAddButton(/Add badge/).disabled).toBe(true);
    expect(screen.queryByText("Name, icon, stat key, and badge line are required.")).toBeNull();
  });

  it("clicking Add badge while enabled calls createRealmBadge with the trimmed input", async () => {
    createRealmBadge.mockResolvedValue({});
    await renderEditor();
    fireEvent.click(screen.getByRole("button", { name: "Add realm badge" }));
    fireEvent.change(screen.getByPlaceholderText("Trailblazer"), { target: { value: "New Badge" } });
    fireEvent.change(screen.getByPlaceholderText("🔥"), { target: { value: "⭐" } });
    fireEvent.change(screen.getAllByPlaceholderText("adventures")[0]!, { target: { value: "quests" } });
    fireEvent.change(screen.getAllByPlaceholderText("adventures")[1]!, { target: { value: "questing" } });
    fireEvent.change(screen.getByPlaceholderText("10"), { target: { value: "5" } });
    fireEvent.change(screen.getByPlaceholderText("50"), { target: { value: "25" } });
    fireEvent.click(saveOrAddButton(/Add badge/));
    await waitFor(() => expect(createRealmBadge).toHaveBeenCalledTimes(1));
    expect(createRealmBadge).toHaveBeenCalledWith(
      "eco-1",
      expect.objectContaining({ name: "New Badge", icon: "⭐", statKey: "quests", badgeLine: "questing" }),
    );
  });
});

describe("CatalogSection badge dialog (edit mode) — disabled at mount, enabled after a real edit", () => {
  it("is disabled at mount (loaded, unedited)", async () => {
    await renderEditor([EXISTING_BADGE]);
    fireEvent.click(await screen.findByRole("button", { name: /Edit/i }));
    expect(saveOrAddButton(/Save changes/).disabled).toBe(true);
  });

  it("enables once a field is changed", async () => {
    await renderEditor([EXISTING_BADGE]);
    fireEvent.click(await screen.findByRole("button", { name: /Edit/i }));
    fireEvent.change(screen.getByDisplayValue("Trailblazer"), { target: { value: "Trailblazer II" } });
    expect(saveOrAddButton(/Save changes/).disabled).toBe(false);
  });

  it("disables again if the edit is reverted back to the loaded value", async () => {
    await renderEditor([EXISTING_BADGE]);
    fireEvent.click(await screen.findByRole("button", { name: /Edit/i }));
    const nameInput = screen.getByDisplayValue("Trailblazer");
    fireEvent.change(nameInput, { target: { value: "Trailblazer II" } });
    expect(saveOrAddButton(/Save changes/).disabled).toBe(false);
    fireEvent.change(nameInput, { target: { value: "Trailblazer" } });
    expect(saveOrAddButton(/Save changes/).disabled).toBe(true);
  });

  // The dirty check has to diff what the SUBMIT sends, and submit sends `name.trim()`. Diffing the
  // raw drafts lit Save up for a PATCH with a byte-identical body — the no-op write the gate exists
  // to prevent.
  it("a trailing space in the name is not an edit — Save stays grey", async () => {
    await renderEditor([EXISTING_BADGE]);
    fireEvent.click(await screen.findByRole("button", { name: /Edit/i }));
    fireEvent.change(screen.getByDisplayValue("Trailblazer"), {
      target: { value: "Trailblazer  " },
    });
    expect(saveOrAddButton(/Save changes/).disabled).toBe(true);
  });

  // `threshold`/`pointValue` go out as `Number(...)`, so leading zeroes are a keystroke the write
  // throws away too.
  it("a leading zero on the threshold is not an edit — Save stays grey", async () => {
    await renderEditor([EXISTING_BADGE]);
    fireEvent.click(await screen.findByRole("button", { name: /Edit/i }));
    fireEvent.change(screen.getByDisplayValue("10"), { target: { value: "010" } });
    expect(saveOrAddButton(/Save changes/).disabled).toBe(true);
  });
});

// The badge dialog's `onOpenChange` is how Escape, a backdrop click and the × ALL reach the
// close path, so firing Escape exercises that whole path rather than a bespoke one.
describe("CatalogSection badge dialog — Escape on a dirty draft asks before discarding", () => {
  it("does not close on Escape while dirty; Discard then closes", async () => {
    await renderEditor([EXISTING_BADGE]);
    fireEvent.click(await screen.findByRole("button", { name: "Edit Trailblazer" }));
    const nameField = screen.getByPlaceholderText("Trailblazer");
    fireEvent.change(nameField, { target: { value: "Pathfinder" } });

    fireEvent.keyDown(nameField, { key: "Escape" });
    expect(screen.queryByText("Edit realm badge")).not.toBeNull();

    // The alert is destructive and ignores Escape by design — Discard/Stay is the only
    // way out, which is exactly what clicking through it asserts.
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    await waitFor(() => expect(screen.queryByText("Edit realm badge")).toBeNull());
  });

  it("Stay keeps the dialog open with the edit intact", async () => {
    await renderEditor([EXISTING_BADGE]);
    fireEvent.click(await screen.findByRole("button", { name: "Edit Trailblazer" }));
    const nameField = screen.getByPlaceholderText("Trailblazer") as HTMLInputElement;
    fireEvent.change(nameField, { target: { value: "Pathfinder" } });

    fireEvent.keyDown(nameField, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Stay" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Discard" })).toBeNull());
    expect(screen.queryByText("Edit realm badge")).not.toBeNull();
    expect((screen.getByPlaceholderText("Trailblazer") as HTMLInputElement).value).toBe("Pathfinder");
  });

  it("closes immediately on Escape when the loaded draft is untouched — no alert", async () => {
    await renderEditor([EXISTING_BADGE]);
    fireEvent.click(await screen.findByRole("button", { name: "Edit Trailblazer" }));
    fireEvent.keyDown(screen.getByPlaceholderText("Trailblazer"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByText("Edit realm badge")).toBeNull());
    expect(screen.queryByRole("button", { name: "Discard" })).toBeNull();
  });

  // The false-positive test: a blank Add dialog is NOT unsaved work, so opening one and
  // changing your mind must not nag. This is why the gate diffs against the blank baseline
  // rather than reusing the Save gate's `dirty` (which is unconditionally true in add mode).
  it("closes immediately on Escape from an untouched Add dialog — a blank draft is not unsaved work", async () => {
    await renderEditor([]);
    fireEvent.click(screen.getByRole("button", { name: "Add realm badge" }));
    fireEvent.keyDown(screen.getByPlaceholderText("Trailblazer"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByText("Add realm badge")).toBeNull());
    expect(screen.queryByRole("button", { name: "Discard" })).toBeNull();
  });

  it("Cancel is gated the same way as Escape — the two are one close path", async () => {
    await renderEditor([EXISTING_BADGE]);
    fireEvent.click(await screen.findByRole("button", { name: "Edit Trailblazer" }));
    fireEvent.change(screen.getByPlaceholderText("Trailblazer"), { target: { value: "Pathfinder" } });

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText("Edit realm badge")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Discard" })).toBeTruthy();
  });
});

/** Reads the settings registry the way the overlay's close gate does — from an event handler. */
function DirtyReadout() {
  const { isAnyDirty } = useSettingsDirty();
  const [seen, setSeen] = useState<string | null>(null);
  return (
    <div>
      <button type="button" onClick={() => setSeen(isAnyDirty() ? "dirty" : "clean")}>
        Read
      </button>
      {seen && <p>registry sees {seen}</p>}
    </div>
  );
}

function readRegistry() {
  // `hidden: true` because Base UI's Dialog inerts (aria-hidden) everything behind it — with the
  // badge dialog open, the default role query cannot see the readout at all.
  fireEvent.click(screen.getByRole("button", { name: "Read", hidden: true }));
}

describe("CatalogSection reports its unsaved badge draft to the settings registry", () => {
  async function renderInRegistry(badges: CatalogBadge[] = []) {
    getCatalog.mockResolvedValue({ badges, levels: [] });
    render(
      <SettingsDirtyProvider>
        <DirtyReadout />
        <RealmCatalogProvider ecosystemId="eco-1">
          <CatalogSection ecosystemId="eco-1" />
        </RealmCatalogProvider>
      </SettingsDirtyProvider>,
    );
    await waitFor(() => expect(getCatalog).toHaveBeenCalled());
  }

  // The dialog gates its OWN exits (Escape / backdrop / × / Cancel). A reload or a link click
  // while it is open is not one of those, so the draft has to reach the registry too.
  it("reports a dirty badge dialog, so a browser-level exit is guarded as well", async () => {
    await renderInRegistry([EXISTING_BADGE]);
    fireEvent.click(await screen.findByRole("button", { name: "Edit Trailblazer" }));
    fireEvent.change(screen.getByPlaceholderText("Trailblazer"), { target: { value: "Pathfinder" } });
    readRegistry();
    expect(screen.getByText("registry sees dirty")).toBeTruthy();
  });

  it("stays clean for a badge dialog opened and left untouched", async () => {
    await renderInRegistry([EXISTING_BADGE]);
    fireEvent.click(await screen.findByRole("button", { name: "Edit Trailblazer" }));
    readRegistry();
    expect(screen.getByText("registry sees clean")).toBeTruthy();
  });

  it("stays clean with no dialog open at all", async () => {
    await renderInRegistry([EXISTING_BADGE]);
    await screen.findByRole("button", { name: "Edit Trailblazer" });
    readRegistry();
    expect(screen.getByText("registry sees clean")).toBeTruthy();
  });
});
