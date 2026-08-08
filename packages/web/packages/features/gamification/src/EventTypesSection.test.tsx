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

const { listEventTypes, createEventType, updateEventType } = vi.hoisted(() => ({
  listEventTypes: vi.fn(),
  createEventType: vi.fn(),
  updateEventType: vi.fn(),
}));
vi.mock("@agentic-toolkit/data/gamification", () => ({
  gamificationApi: {
    listEventTypes,
    createEventType,
    updateEventType,
    deleteEventType: vi.fn(),
  },
}));

import { EventTypesSection, sameEventTypeDraft } from "./EventTypesSection";
import type { RealmEventType } from "@agentic-toolkit/data/gamification";

afterEach(cleanup);

const EXISTING_TYPE: RealmEventType = {
  id: "type-1",
  name: "quest_completed",
  statKey: "adventures",
} as RealmEventType;

function saveOrAddButton(name: RegExp) {
  return screen.getByRole("button", { name }) as HTMLButtonElement;
}

// `sameEventTypeDraft` backs the dirty check that feeds `useReportSettingsDirty`. It used to be
// `JSON.stringify(draft) !== JSON.stringify(baselineDraft)`, which is unsound in both directions:
// key order flips a structurally-equal pair to "different" (a false dirty — the guard nags on
// exit with nothing actually changed), and it can't be relied on to catch every real change
// either, since two differently-key-ordered objects that DO differ can still stringify to
// strings that differ for the wrong reason. This pins the direction that's cheap to demonstrate
// directly: reordered-but-equal must read as the same, and a genuine single-field edit must
// still read as different.
describe("sameEventTypeDraft", () => {
  it("treats a reordered-but-equal draft as the same (no false dirty)", () => {
    const a = { name: "quest_completed", statKey: "adventures" };
    const b = { statKey: "adventures", name: "quest_completed" };
    expect(sameEventTypeDraft(a, b)).toBe(true);
  });

  it("treats a real single-field change as different", () => {
    const a = { name: "quest_completed", statKey: "adventures" };
    const b = { name: "quest_completed", statKey: "levels" };
    expect(sameEventTypeDraft(a, b)).toBe(false);
  });
});

async function renderEditor(types: RealmEventType[] = []) {
  listEventTypes.mockResolvedValue(types);
  render(<EventTypesSection ecosystemId="eco-1" />);
  await waitFor(() => expect(listEventTypes).toHaveBeenCalled());
}
// Same rule as CatalogSection.test.tsx: this resolves once listEventTypes has been
// CALLED, not once its rows have rendered. Reach anything derived from `types` with
// an awaited findBy*; the "Add event type" trigger renders unconditionally and is
// safe with getBy. No RealmCatalogProvider around it — event types are their own
// endpoint, not part of the catalog response, so this section still owns its fetch.

describe("EventTypesSection dialog (add mode) — Save disabled at mount, enabled after a valid edit", () => {
  it("is disabled the moment the Add dialog opens (all fields blank)", async () => {
    await renderEditor();
    fireEvent.click(screen.getByRole("button", { name: "Add event type" }));
    expect(saveOrAddButton(/Add event type/).disabled).toBe(true);
  });

  it("stays disabled with only one required field filled", async () => {
    await renderEditor();
    fireEvent.click(screen.getByRole("button", { name: "Add event type" }));
    fireEvent.change(screen.getByPlaceholderText("quest_completed"), {
      target: { value: "level_up" },
    });
    expect(saveOrAddButton(/Add event type/).disabled).toBe(true);
  });

  it("enables once both required fields are filled", async () => {
    await renderEditor();
    fireEvent.click(screen.getByRole("button", { name: "Add event type" }));
    fireEvent.change(screen.getByPlaceholderText("quest_completed"), {
      target: { value: "level_up" },
    });
    fireEvent.change(screen.getByPlaceholderText("adventures"), {
      target: { value: "levels" },
    });
    expect(saveOrAddButton(/Add event type/).disabled).toBe(false);
  });

  // `canSave` disables the button, so `submit()`'s own required-fields guard — and the message it
  // sets — can no longer be reached by clicking. The reason has to be rendered instead.
  it("says WHY Save is blocked once one field is filled and the other is not", async () => {
    await renderEditor();
    fireEvent.click(screen.getByRole("button", { name: "Add event type" }));
    fireEvent.change(screen.getByPlaceholderText("quest_completed"), {
      target: { value: "level_up" },
    });
    expect(saveOrAddButton(/Add event type/).disabled).toBe(true);
    expect(screen.getByText("Name and stat key are required.")).toBeTruthy();
  });

  // Create surfaces speak from the FIRST frame. `openAdd()` opens a blank draft, so the dialog
  // mounts already blocked — with `canSave` false and `submit()`'s guard unreachable by click,
  // a `dirty` term here would leave the Add dialog showing a dead button and no reason at all.
  it("says WHY Save is blocked on the very first frame of the Add dialog", async () => {
    await renderEditor();
    fireEvent.click(screen.getByRole("button", { name: "Add event type" }));
    expect(saveOrAddButton(/Add event type/).disabled).toBe(true);
    expect(screen.getByText("Name and stat key are required.")).toBeTruthy();
  });

  it("clicking Add event type while enabled calls createEventType with the trimmed input", async () => {
    createEventType.mockResolvedValue({});
    await renderEditor();
    fireEvent.click(screen.getByRole("button", { name: "Add event type" }));
    fireEvent.change(screen.getByPlaceholderText("quest_completed"), {
      target: { value: "level_up" },
    });
    fireEvent.change(screen.getByPlaceholderText("adventures"), {
      target: { value: "levels" },
    });
    fireEvent.click(saveOrAddButton(/Add event type/));
    await waitFor(() => expect(createEventType).toHaveBeenCalledTimes(1));
    expect(createEventType).toHaveBeenCalledWith("eco-1", { name: "level_up", statKey: "levels" });
  });
});

describe("EventTypesSection dialog (edit mode) — disabled at mount, enabled after a real edit", () => {
  it("is disabled at mount (loaded, unedited)", async () => {
    await renderEditor([EXISTING_TYPE]);
    fireEvent.click(await screen.findByRole("button", { name: /Edit/i }));
    expect(saveOrAddButton(/Save changes/).disabled).toBe(true);
  });

  it("enables once a field is changed", async () => {
    await renderEditor([EXISTING_TYPE]);
    fireEvent.click(await screen.findByRole("button", { name: /Edit/i }));
    fireEvent.change(screen.getByDisplayValue("quest_completed"), {
      target: { value: "quest_completed_v2" },
    });
    expect(saveOrAddButton(/Save changes/).disabled).toBe(false);
  });

  // The counterpart to the Add dialog's first-frame assertion above: dropping the `dirty` term
  // must NOT make the EDIT surface open by complaining. It doesn't, and not by luck — a loaded
  // row has both required fields set, so `blockedReason` is already null at mount.
  it("opens quiet in edit mode (a loaded row has nothing blocking Save)", async () => {
    await renderEditor([EXISTING_TYPE]);
    fireEvent.click(await screen.findByRole("button", { name: /Edit/i }));
    expect(saveOrAddButton(/Save changes/).disabled).toBe(true);
    expect(screen.queryByText("Name and stat key are required.")).toBeNull();
  });

  it("says WHY Save is blocked once a required field is cleared", async () => {
    await renderEditor([EXISTING_TYPE]);
    fireEvent.click(await screen.findByRole("button", { name: /Edit/i }));
    fireEvent.change(screen.getByDisplayValue("quest_completed"), { target: { value: "" } });
    expect(saveOrAddButton(/Save changes/).disabled).toBe(true);
    expect(screen.getByText("Name and stat key are required.")).toBeTruthy();
  });

  it("disables again if the edit is reverted back to the loaded value", async () => {
    await renderEditor([EXISTING_TYPE]);
    fireEvent.click(await screen.findByRole("button", { name: /Edit/i }));
    const nameInput = screen.getByDisplayValue("quest_completed");
    fireEvent.change(nameInput, { target: { value: "quest_completed_v2" } });
    expect(saveOrAddButton(/Save changes/).disabled).toBe(false);
    fireEvent.change(nameInput, { target: { value: "quest_completed" } });
    expect(saveOrAddButton(/Save changes/).disabled).toBe(true);
  });
});

// The dialog's `onOpenChange` is how Escape, a backdrop click and the × ALL reach the close
// path, so firing Escape exercises that whole path rather than a bespoke one. Presence is read
// off the name field's placeholder rather than the title, because "Add event type" is also the
// trigger button's and the submit button's label.
describe("EventTypesSection dialog — Escape on a dirty draft asks before discarding", () => {
  function nameField() {
    return screen.getByPlaceholderText("quest_completed") as HTMLInputElement;
  }
  function dialogIsOpen() {
    return screen.queryByPlaceholderText("quest_completed") !== null;
  }

  it("does not close on Escape while dirty; Discard then closes", async () => {
    await renderEditor([EXISTING_TYPE]);
    fireEvent.click(await screen.findByRole("button", { name: "Edit quest_completed" }));
    fireEvent.change(nameField(), { target: { value: "quest_abandoned" } });

    fireEvent.keyDown(nameField(), { key: "Escape" });
    expect(dialogIsOpen()).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    await waitFor(() => expect(dialogIsOpen()).toBe(false));
  });

  it("Stay keeps the dialog open with the edit intact", async () => {
    await renderEditor([EXISTING_TYPE]);
    fireEvent.click(await screen.findByRole("button", { name: "Edit quest_completed" }));
    fireEvent.change(nameField(), { target: { value: "quest_abandoned" } });

    fireEvent.keyDown(nameField(), { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Stay" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Discard" })).toBeNull());
    expect(nameField().value).toBe("quest_abandoned");
  });

  it("closes immediately on Escape when the loaded draft is untouched — no alert", async () => {
    await renderEditor([EXISTING_TYPE]);
    fireEvent.click(await screen.findByRole("button", { name: "Edit quest_completed" }));
    fireEvent.keyDown(nameField(), { key: "Escape" });
    await waitFor(() => expect(dialogIsOpen()).toBe(false));
    expect(screen.queryByRole("button", { name: "Discard" })).toBeNull();
  });

  // The false-positive test: a blank Add dialog holds no unsaved work, so changing your mind
  // about opening it must not nag.
  it("closes immediately on Escape from an untouched Add dialog — a blank draft is not unsaved work", async () => {
    await renderEditor([]);
    fireEvent.click(screen.getByRole("button", { name: "Add event type" }));
    fireEvent.keyDown(nameField(), { key: "Escape" });
    await waitFor(() => expect(dialogIsOpen()).toBe(false));
    expect(screen.queryByRole("button", { name: "Discard" })).toBeNull();
  });

  it("Cancel is gated the same way as Escape — the two are one close path", async () => {
    await renderEditor([EXISTING_TYPE]);
    fireEvent.click(await screen.findByRole("button", { name: "Edit quest_completed" }));
    fireEvent.change(nameField(), { target: { value: "quest_abandoned" } });

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(dialogIsOpen()).toBe(true);
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
  // dialog open, the default role query cannot see the readout at all.
  fireEvent.click(screen.getByRole("button", { name: "Read", hidden: true }));
}

// The dialog gates its OWN exits (Escape / backdrop / × / Cancel). A reload, a link click or a
// rail row switch is none of those, so the open draft has to reach the settings registry too.
describe("EventTypesSection reports its unsaved dialog draft to the settings registry", () => {
  async function renderInRegistry(types: RealmEventType[] = []) {
    listEventTypes.mockResolvedValue(types);
    render(
      <SettingsDirtyProvider>
        <DirtyReadout />
        <EventTypesSection ecosystemId="eco-1" />
      </SettingsDirtyProvider>,
    );
    await waitFor(() => expect(listEventTypes).toHaveBeenCalled());
  }

  it("stays clean with no dialog open", async () => {
    await renderInRegistry([EXISTING_TYPE]);
    readRegistry();
    expect(screen.getByText("registry sees clean")).toBeTruthy();
  });

  it("stays clean for an Add dialog opened and left untouched", async () => {
    await renderInRegistry([EXISTING_TYPE]);
    fireEvent.click(screen.getByRole("button", { name: "Add event type" }));
    readRegistry();
    expect(screen.getByText("registry sees clean")).toBeTruthy();
  });

  it("reports dirty once the open draft is edited", async () => {
    await renderInRegistry([EXISTING_TYPE]);
    fireEvent.click(await screen.findByRole("button", { name: /Edit/i }));
    fireEvent.change(screen.getByDisplayValue("quest_completed"), {
      target: { value: "quest_failed" },
    });
    readRegistry();
    expect(screen.getByText("registry sees dirty")).toBeTruthy();
  });

  it("withdraws the report once the dialog is discarded away", async () => {
    await renderInRegistry([EXISTING_TYPE]);
    fireEvent.click(await screen.findByRole("button", { name: /Edit/i }));
    fireEvent.change(screen.getByDisplayValue("quest_completed"), {
      target: { value: "quest_failed" },
    });
    fireEvent.keyDown(screen.getByDisplayValue("quest_failed"), { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Discard", hidden: true }));
    readRegistry();
    expect(screen.getByText("registry sees clean")).toBeTruthy();
  });
});
