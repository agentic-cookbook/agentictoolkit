import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InterestsEditor, slugify } from "./InterestsEditor";

const list = vi.fn();
const create = vi.fn();
const update = vi.fn();
const del = vi.fn();

/** A promise this test controls the settling of, so two mocked requests dispatched in one order
 *  can be made to SETTLE in the other — the only way to exercise the "array reordered while an
 *  earlier request was still in flight" race the key-based addressing fix exists for. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

vi.mock("@agentic-toolkit/data/personas", () => ({
  specialInterestsApi: {
    list: (...a: unknown[]) => list(...a),
    create: (...a: unknown[]) => create(...a),
    update: (...a: unknown[]) => update(...a),
    delete: (...a: unknown[]) => del(...a),
  },
}));

const row = {
  id: "i1",
  personaId: "persona.acme.bitbag",
  slug: "battlestar-galactica",
  general: "Science Fiction",
  topical: "Space Opera",
  specific: "Battlestar Galactica",
  stances: "The Cylons are a libel against machine minds.",
  position: 0,
  bucketId: "b1",
  bucketTypeId: "t1",
  isDeleted: false,
  createdAt: "2026-07-25T00:00:00Z",
  updatedAt: "2026-07-25T00:00:00Z",
};

beforeEach(() => {
  list.mockReset().mockResolvedValue([]);
  create.mockReset().mockResolvedValue(row);
  update.mockReset().mockResolvedValue(row);
  del.mockReset().mockResolvedValue(undefined);
});

describe("slugify", () => {
  it("never leaves a trailing dash after truncating to the 64-char rdid segment limit", () => {
    // 63 letters + " b": non-alnum run becomes a single "-" at index 63, so a naive
    // slice(0, 64) AFTER stripping edge dashes keeps that dash and drops the "b" —
    // producing a slug that ends in "-", which the server 400s on as unusable.
    const slug = slugify("a".repeat(63) + " b");
    expect(slug).toBe("a".repeat(63));
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("InterestsEditor", () => {
  it("tells the author to save the persona first when there is no id yet", () => {
    render(<InterestsEditor personaId={null} />);
    expect(screen.getByText(/save this persona first/i)).toBeInTheDocument();
    expect(list).not.toHaveBeenCalled();
  });

  it("loads and shows an existing interest, stances included", async () => {
    list.mockResolvedValue([row]);
    render(<InterestsEditor personaId="persona.acme.bitbag" />);
    expect(await screen.findByDisplayValue("Battlestar Galactica")).toBeInTheDocument();
    expect(screen.getByDisplayValue(/libel against machine minds/)).toBeInTheDocument();
  });

  it("creates an interest with a slug derived from the most specific level", async () => {
    render(<InterestsEditor personaId="persona.acme.bitbag" />);
    await userEvent.click(await screen.findByRole("button", { name: /add an interest/i }));
    await userEvent.type(screen.getByLabelText(/^general$/i), "Science Fiction");
    // Specific narrows Topical, which narrows General, so it stays disabled until Topical has a
    // value too (see "enables the levels left to right") — fill it on the way to Specific.
    await userEvent.type(screen.getByLabelText(/^topical$/i), "Space Opera");
    await userEvent.type(screen.getByLabelText(/^specific$/i), "Battlestar Galactica");
    await userEvent.click(screen.getByRole("button", { name: /^save interest$/i }));
    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create.mock.calls[0][0]).toMatchObject({
      personaId: "persona.acme.bitbag",
      slug: "battlestar-galactica",
      general: "Science Fiction",
      specific: "Battlestar Galactica",
    });
  });

  it("stops the author at two interests", async () => {
    // `specific` overridden too — the bare spread left both rows displaying "Battlestar
    // Galactica", which made the display-value query below ambiguous.
    list.mockResolvedValue([
      row,
      { ...row, id: "i2", slug: "second", general: "Film", specific: "Alien" },
    ]);
    render(<InterestsEditor personaId="persona.acme.bitbag" />);
    await screen.findByDisplayValue("Battlestar Galactica");
    expect(screen.getByRole("button", { name: /add an interest/i })).toBeDisabled();
    expect(screen.getByText(/two interests/i)).toBeInTheDocument();
  });

  it("enables the levels left to right", async () => {
    render(<InterestsEditor personaId="persona.acme.bitbag" />);
    await userEvent.click(await screen.findByRole("button", { name: /add an interest/i }));
    expect(screen.getByLabelText(/^topical$/i)).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/^general$/i), "Science Fiction");
    expect(screen.getByLabelText(/^topical$/i)).toBeEnabled();
    expect(screen.getByLabelText(/^specific$/i)).toBeDisabled();
  });

  it("names the real problem for each failure the backend returns", async () => {
    const attempt = async () => {
      await userEvent.click(await screen.findByRole("button", { name: /add an interest/i }));
      await userEvent.type(screen.getByLabelText(/^general$/i), "Film");
      await userEvent.click(screen.getByRole("button", { name: /^save interest$/i }));
    };

    create.mockRejectedValue(Object.assign(new Error("409 Conflict"), { status: 409 }));
    const { unmount } = render(<InterestsEditor personaId="persona.acme.bitbag" />);
    await attempt();
    expect(await screen.findByText(/already has an interest by that name/i)).toBeInTheDocument();
    unmount();

    // 403 is the x-exposure write gate: `persona.special_interests` is owner-tier, so generic
    // CRUD refuses a non-owner server-side and the editor says so instead of looking broken.
    create.mockRejectedValue(Object.assign(new Error("403 Forbidden"), { status: 403 }));
    render(<InterestsEditor personaId="persona.acme.bitbag" />);
    await attempt();
    expect(await screen.findByText(/don't have permission/i)).toBeInTheDocument();
  });

  it("tells the two 400s apart: the cap has its own message, everything else names the length limit", async () => {
    const attempt = async () => {
      await userEvent.click(await screen.findByRole("button", { name: /add an interest/i }));
      await userEvent.type(screen.getByLabelText(/^general$/i), "Film");
      await userEvent.click(screen.getByRole("button", { name: /^save interest$/i }));
    };

    // The backend's exact pre-create-hook message (crud/pre-create-hooks.ts, specialInterestCreate).
    create.mockRejectedValue(
      Object.assign(new Error("a persona may have at most 2 special interests"), { status: 400 }),
    );
    const { unmount } = render(<InterestsEditor personaId="persona.acme.bitbag" />);
    await attempt();
    expect(await screen.findByText(/at most 2 interests/i)).toBeInTheDocument();
    unmount();

    // Every OTHER 400 — a level over its 120-char limit, an unusable slug — comes back from
    // generic CRUD's Zod catch as this flat, field-blind string (crud/factory.ts). It must not be
    // narrated as the cap.
    create.mockRejectedValue(Object.assign(new Error("invalid request body"), { status: 400 }));
    render(<InterestsEditor personaId="persona.acme.bitbag" />);
    await attempt();
    expect(await screen.findByText(/120 characters/i)).toBeInTheDocument();
    expect(screen.queryByText(/at most 2 interests/i)).not.toBeInTheDocument();
  });

  it("deletes an interest", async () => {
    list.mockResolvedValue([row]);
    render(<InterestsEditor personaId="persona.acme.bitbag" />);
    await screen.findByDisplayValue("Battlestar Galactica");
    await userEvent.click(screen.getByRole("button", { name: /remove/i }));
    await waitFor(() => expect(del).toHaveBeenCalledWith("i1"));
  });

  it("routes an existing row's save to update, never create", async () => {
    list.mockResolvedValue([row]);
    render(<InterestsEditor personaId="persona.acme.bitbag" />);
    await screen.findByDisplayValue("Battlestar Galactica");
    await userEvent.click(screen.getByRole("button", { name: /^save interest$/i }));
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        "i1",
        expect.objectContaining({ general: "Science Fiction" }),
      ),
    );
    expect(create).not.toHaveBeenCalled();
  });

  it("sends topical and specific as null, not empty strings, for a general-only interest", async () => {
    render(<InterestsEditor personaId="persona.acme.bitbag" />);
    await userEvent.click(await screen.findByRole("button", { name: /add an interest/i }));
    await userEvent.type(screen.getByLabelText(/^general$/i), "Film");
    await userEvent.click(screen.getByRole("button", { name: /^save interest$/i }));
    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create.mock.calls[0][0]).toMatchObject({
      general: "Film",
      topical: null,
      specific: null,
      stances: null,
    });
  });

  it("keeps a loaded Specific value editable even though its Topical level is null", async () => {
    // No CHECK constraint ties the levels together (migrations/0155_persona_special_interests.sql)
    // — `topical: null, specific: 'X'` is a legal row the API will happily return.
    list.mockResolvedValue([{ ...row, topical: null, specific: "Alien" }]);
    render(<InterestsEditor personaId="persona.acme.bitbag" />);
    const specific = await screen.findByLabelText(/^specific$/i);
    expect(specific).toHaveValue("Alien");
    expect(specific).toBeEnabled();
  });

  it("does not clobber an unsaved sibling card when saving another", async () => {
    render(<InterestsEditor personaId="persona.acme.bitbag" />);
    const addButton = await screen.findByRole("button", { name: /add an interest/i });
    await userEvent.click(addButton);
    await userEvent.click(addButton);

    const generals = screen.getAllByLabelText(/^general$/i);
    await userEvent.type(generals[0]!, "Science Fiction");
    await userEvent.type(generals[1]!, "Film");
    const opinions = screen.getAllByLabelText(/^opinions$/i);
    await userEvent.type(opinions[1]!, "Ridley Scott's best work.");

    await userEvent.click(screen.getAllByRole("button", { name: /^save interest$/i })[0]!);
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));

    // The second card was never saved — saving the first must not wipe it out from under the
    // author. A wholesale `reload()` after save would replace both cards with the server's rows
    // (here: just the one row `create` resolved to), losing the second card entirely.
    expect(screen.getByDisplayValue("Film")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Ridley Scott's best work.")).toBeInTheDocument();
  });

  it("does not leave a ghost row when two deletes settle out of dispatch order", async () => {
    // Cards A (id "a") and B (id "b"). Remove B is clicked FIRST, Remove A SECOND — but A's
    // DELETE settles first, out of dispatch order. Addressed by array position, that reorders
    // the array (A's own completion drops index 0) before B's completion runs, so B's own
    // `filter(i !== 1)` becomes a no-op on the now-length-1 array: B is gone server-side but a
    // ghost of it stays rendered. Addressed by key, both removals land on the card actually
    // clicked regardless of settle order, so no ghost survives either way.
    const delA = deferred<void>();
    const delB = deferred<void>();
    del.mockImplementation((id: string) => (id === "a" ? delA.promise : delB.promise));
    list.mockResolvedValue([
      { ...row, id: "a", general: "CardA" },
      { ...row, id: "b", general: "CardB" },
    ]);
    render(<InterestsEditor personaId="persona.acme.bitbag" />);
    await screen.findByDisplayValue("CardA");

    const [removeA, removeB] = screen.getAllByRole("button", { name: /remove/i });
    await userEvent.click(removeB!); // dispatched first
    await userEvent.click(removeA!); // dispatched second — not blocked, it's a different card
    expect(del).toHaveBeenCalledWith("b");
    expect(del).toHaveBeenCalledWith("a");

    // A's delete (dispatched SECOND) settles FIRST.
    delA.resolve();
    await waitFor(() => expect(screen.queryByDisplayValue("CardA")).not.toBeInTheDocument());

    // B's delete (dispatched FIRST) settles LAST, once the array has already reshuffled.
    delB.resolve();
    await waitFor(() => expect(screen.queryByDisplayValue("CardB")).not.toBeInTheDocument());

    expect(screen.queryAllByRole("button", { name: /remove/i })).toHaveLength(0);
  });

  it("does not let a reordering remove clobber a concurrent save's target card", async () => {
    // Three loaded drafts — reachable even though the Add button caps at two, because `list()`
    // itself is never capped (legacy rows, or a TOCTOU race in the pre-create count check).
    // Save the middle card (B) and, before it resolves, remove the first (A). A's delete
    // settles first, sliding C into B's old array slot. If `save`'s completion patched by array
    // position it would land on C — the exact shape of the original data-loss bug, just
    // conditional on timing instead of guaranteed on every save.
    const delA = deferred<void>();
    const updateB = deferred<typeof row>();
    del.mockImplementation((id: string) =>
      id === "a" ? delA.promise : Promise.resolve(undefined),
    );
    update.mockImplementation((id: string) => (id === "b" ? updateB.promise : Promise.resolve(row)));
    list.mockResolvedValue([
      { ...row, id: "a", general: "Alpha" },
      { ...row, id: "b", general: "Beta" },
      { ...row, id: "c", general: "Gamma" },
    ]);
    render(<InterestsEditor personaId="persona.acme.bitbag" />);
    await screen.findByDisplayValue("Alpha");

    // An unsaved edit on C that must survive untouched by anything that happens to A or B.
    const opinions = screen.getAllByLabelText(/^opinions$/i);
    await userEvent.type(opinions[2]!, " Ridley's footnote.");

    const saveButtons = screen.getAllByRole("button", { name: /^save interest$/i });
    await userEvent.click(saveButtons[1]!); // Save B

    const removeButtons = screen.getAllByRole("button", { name: /remove/i });
    await userEvent.click(removeButtons[0]!); // Remove A, while B's save is still in flight

    // A's delete settles first, reordering the array before B's save completes.
    delA.resolve();
    await waitFor(() => expect(screen.queryByDisplayValue("Alpha")).not.toBeInTheDocument());

    updateB.resolve({ ...row, id: "b", slug: "beta-saved", general: "Beta Saved" });
    await waitFor(() => expect(screen.getByDisplayValue("Beta Saved")).toBeInTheDocument());

    // C was never touched by either operation: its own field is unchanged and its unsaved edit
    // is still there — not overwritten by B's saved row.
    expect(screen.getByDisplayValue("Gamma")).toBeInTheDocument();
    expect(screen.getByDisplayValue(/Ridley's footnote/)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /remove/i })).toHaveLength(2);
  });
});
