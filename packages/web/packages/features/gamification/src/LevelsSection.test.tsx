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

const { getCatalog, putRealmLevels } = vi.hoisted(() => ({
  getCatalog: vi.fn(),
  putRealmLevels: vi.fn(),
}));
vi.mock("@agentic-toolkit/data/gamification", () => ({
  gamificationApi: {
    getCatalog,
    putRealmLevels,
    createRealmBadge: vi.fn(),
    updateRealmBadge: vi.fn(),
    deleteRealmBadge: vi.fn(),
    replayRealm: vi.fn(),
  },
}));

import { LevelsSection } from "./LevelsSection";
import { RealmCatalogProvider } from "./realm-catalog";

// `vi.clearAllMocks()` on top of the usual cleanup, because this file is the one that asserts a
// CALL COUNT (`getCatalog` twice — the mount read plus the post-save re-read) on a mock EVERY test
// here triggers. Call records are per-mock, not per-test, so without this the count is the whole
// file's running total and the assertion reads as a mystery off-by-N. Implementations survive
// (`clearAllMocks` is mockClear, not mockReset), and each test re-arms its own resolved value.
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const LEVELS = [
  { name: "Novice", minPoints: 0 },
  { name: "Adept", minPoints: 100 },
];

function saveOrAddButton(name: RegExp) {
  return screen.getByRole("button", { name }) as HTMLButtonElement;
}

async function renderEditor(levels: { name: string; minPoints: number }[] = []) {
  getCatalog.mockResolvedValue({ badges: [], levels });
  render(
    <RealmCatalogProvider ecosystemId="eco-1">
      <LevelsSection ecosystemId="eco-1" />
    </RealmCatalogProvider>,
  );
  await waitFor(() => expect(getCatalog).toHaveBeenCalled());
}
// NOTE: renderEditor resolves as soon as getCatalog has been CALLED — not once its promise has
// settled and the rungs it feeds have rendered. Every rung control must therefore be reached with
// an awaited findBy*, never a synchronous getBy*: the sync form passes on an idle machine and
// fails under a loaded `pnpm -r run test`. Post-split there is no unconditionally-rendered
// control to lean on either — the whole ladder is behind `catalog &&`, because as its own topic a
// bare rung list with nothing above it would read as "this realm has no levels" during the load.

describe("LevelsSection — Save ladder tracks what the PUT would carry", () => {
  it("is disabled at mount (loaded, unedited)", async () => {
    await renderEditor(LEVELS);
    await screen.findByLabelText("Rung 1 name");
    expect(saveOrAddButton(/Save ladder/).disabled).toBe(true);
  });

  it("enables once a rung name is really changed", async () => {
    await renderEditor(LEVELS);
    fireEvent.change(await screen.findByLabelText("Rung 2 name"), {
      target: { value: "Adept II" },
    });
    expect(saveOrAddButton(/Save ladder/).disabled).toBe(false);
  });

  // Same rule as the badge dialog: `ladderPayload` trims every name, so a trailing space is a
  // change the PUT would discard.
  it("a trailing space in a rung name is not an edit — Save ladder stays grey", async () => {
    await renderEditor(LEVELS);
    fireEvent.change(await screen.findByLabelText("Rung 2 name"), {
      target: { value: "Adept  " },
    });
    expect(saveOrAddButton(/Save ladder/).disabled).toBe(true);
  });

  // The first rung's minPoints is forced to 0 on the way out, so whatever is typed there can never
  // reach the server — and must never light Save up either.
  it("a leading zero on a later rung's minPoints is not an edit — Save ladder stays grey", async () => {
    await renderEditor(LEVELS);
    fireEvent.change(await screen.findByLabelText("Rung 2 minimum points"), {
      target: { value: "0100" },
    });
    expect(saveOrAddButton(/Save ladder/).disabled).toBe(true);
  });

  it("saving PUTs the trimmed, 0-anchored ladder and re-reads the shared catalog", async () => {
    putRealmLevels.mockResolvedValue({ levels: [{ name: "Novice", minPoints: 0 }, { name: "Adept II", minPoints: 100 }] });
    await renderEditor(LEVELS);
    fireEvent.change(await screen.findByLabelText("Rung 2 name"), {
      target: { value: " Adept II " },
    });
    fireEvent.click(saveOrAddButton(/Save ladder/));
    await waitFor(() => expect(putRealmLevels).toHaveBeenCalledTimes(1));
    expect(putRealmLevels).toHaveBeenCalledWith("eco-1", [
      { name: "Novice", minPoints: 0 },
      { name: "Adept II", minPoints: 100 },
    ]);
    // The write re-tags the badge rows' `source`, so the sibling Catalog topic has to see it too —
    // which post-split means a second getCatalog through the shared provider, not a local setState.
    await waitFor(() => expect(getCatalog).toHaveBeenCalledTimes(2));
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
  fireEvent.click(screen.getByRole("button", { name: "Read" }));
}

// The ladder is a PANE-level editor: its Save/Reset sit inline on the page, so it has no dialog
// close path of its own to gate. Its exits are all browser/chrome level, which is what the
// settings registry bridges to.
describe("LevelsSection reports its unsaved edits to the settings registry", () => {
  async function renderInRegistry(levels: { name: string; minPoints: number }[] = []) {
    getCatalog.mockResolvedValue({ badges: [], levels });
    render(
      <SettingsDirtyProvider>
        <DirtyReadout />
        <RealmCatalogProvider ecosystemId="eco-1">
          <LevelsSection ecosystemId="eco-1" />
        </RealmCatalogProvider>
      </SettingsDirtyProvider>,
    );
    await waitFor(() => expect(getCatalog).toHaveBeenCalled());
  }

  it("stays clean while the loaded ladder is untouched", async () => {
    await renderInRegistry(LEVELS);
    await screen.findByLabelText("Rung 1 name");
    readRegistry();
    expect(screen.getByText("registry sees clean")).toBeTruthy();
  });

  it("reports dirty once a rung name is really changed", async () => {
    await renderInRegistry(LEVELS);
    fireEvent.change(await screen.findByLabelText("Rung 2 name"), { target: { value: "Adept II" } });
    readRegistry();
    expect(screen.getByText("registry sees dirty")).toBeTruthy();
  });

  // The same no-op edits `ladderPayload` discards must not arm the exit guard either, or every
  // stray keystroke in a rung name nags on the way out.
  it("stays clean for a trailing space the PUT would trim away", async () => {
    await renderInRegistry(LEVELS);
    fireEvent.change(await screen.findByLabelText("Rung 2 name"), { target: { value: "Adept  " } });
    readRegistry();
    expect(screen.getByText("registry sees clean")).toBeTruthy();
  });

  it("goes clean again when the ladder edit is reverted", async () => {
    await renderInRegistry(LEVELS);
    const rung = await screen.findByLabelText("Rung 2 name");
    fireEvent.change(rung, { target: { value: "Adept II" } });
    fireEvent.change(rung, { target: { value: "Adept" } });
    readRegistry();
    expect(screen.getByText("registry sees clean")).toBeTruthy();
  });
});
