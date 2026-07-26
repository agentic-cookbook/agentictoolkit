import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InterestsEditor } from "./InterestsEditor";

const list = vi.fn();
const create = vi.fn();
const update = vi.fn();
const del = vi.fn();

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

  it("deletes an interest", async () => {
    list.mockResolvedValue([row]);
    render(<InterestsEditor personaId="persona.acme.bitbag" />);
    await screen.findByDisplayValue("Battlestar Galactica");
    await userEvent.click(screen.getByRole("button", { name: /remove/i }));
    await waitFor(() => expect(del).toHaveBeenCalledWith("i1"));
  });
});
