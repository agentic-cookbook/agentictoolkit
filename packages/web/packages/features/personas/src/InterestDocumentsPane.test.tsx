import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InterestDocumentsPane, KnowledgeFacet } from "./InterestDocumentsPane";
import type { Persona } from "@agentic-toolkit/data/personas";

const listDocs = vi.fn();
const createDoc = vi.fn();
const deleteDoc = vi.fn();
const tenantId = vi.fn();
const listInterests = vi.fn();

vi.mock("@agentic-toolkit/data", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  useTenantId: () => tenantId(),
}));
vi.mock("@agentic-toolkit/data/personas", () => ({
  interestDocumentsApi: {
    list: (...a: unknown[]) => listDocs(...a),
    create: (...a: unknown[]) => createDoc(...a),
    delete: (...a: unknown[]) => deleteDoc(...a),
    update: vi.fn(),
  },
  // KnowledgeFacet's own dependency — needed only by the KnowledgeFacet tests below, but declared
  // here since the whole module is mocked in one shot.
  specialInterestsApi: {
    list: (...a: unknown[]) => listInterests(...a),
  },
}));

const interest = {
  id: "i1",
  personaId: "persona.acme.bitbag",
  slug: "battlestar-galactica",
  general: "Science Fiction",
  topical: "Space Opera",
  specific: "Battlestar Galactica",
  stances: null,
  position: 0,
  bucketId: "b1",
  bucketTypeId: "t1",
  isDeleted: false,
  createdAt: "2026-07-25T00:00:00Z",
  updatedAt: "2026-07-25T00:00:00Z",
};

beforeEach(() => {
  listDocs.mockReset().mockResolvedValue([]);
  createDoc.mockReset().mockResolvedValue({ id: "d1", title: "T", content: "C" });
  deleteDoc.mockReset().mockResolvedValue(undefined);
  tenantId.mockReset().mockReturnValue("eco-1");
  listInterests.mockReset().mockResolvedValue([]);
});

const props = { personaId: "persona.acme.bitbag", corpusEcosystemId: "eco-1", interest };

describe("InterestDocumentsPane", () => {
  it("lists the documents, acting AS the persona", async () => {
    listDocs.mockResolvedValue([
      { id: "d1", title: "Cylon portrayal", content: "…", createdAt: "", updatedAt: "" },
    ]);
    render(<InterestDocumentsPane {...props} />);
    expect(await screen.findByText("Cylon portrayal")).toBeInTheDocument();
    expect(listDocs).toHaveBeenCalledWith("b1", "t1", "persona.acme.bitbag");
  });

  it("adds a document", async () => {
    render(<InterestDocumentsPane {...props} />);
    await userEvent.click(await screen.findByRole("button", { name: /add a document/i }));
    await userEvent.type(screen.getByLabelText(/title/i), "Cylon portrayal");
    await userEvent.type(screen.getByLabelText(/content/i), "The reimagined series…");
    await userEvent.click(screen.getByRole("button", { name: /^save document$/i }));
    await waitFor(() => expect(createDoc).toHaveBeenCalled());
    expect(createDoc.mock.calls[0].slice(0, 3)).toEqual(["b1", "t1", "persona.acme.bitbag"]);
  });

  it("explains itself instead of failing when the corpus is in another tenant", async () => {
    tenantId.mockReturnValue("eco-OTHER");
    render(<InterestDocumentsPane {...props} />);
    expect(await screen.findByText(/another workspace|ingest/i)).toBeInTheDocument();
    expect(listDocs).not.toHaveBeenCalled();
  });

  it("says so when the bucket has not been provisioned yet", async () => {
    render(<InterestDocumentsPane {...props} interest={{ ...interest, bucketTypeId: null }} />);
    expect(await screen.findByText(/not ready yet/i)).toBeInTheDocument();
    expect(listDocs).not.toHaveBeenCalled();
  });

  it("will not save a document with no content", async () => {
    // `content` IS the document — an empty one is a row the persona can never usefully search, and
    // sending it only surfaces whatever the rows plane says about a blank column as a raw error
    // string. Guard it the same way `title` is guarded, in the UI.
    render(<InterestDocumentsPane {...props} />);
    await userEvent.click(await screen.findByRole("button", { name: /add a document/i }));
    await userEvent.type(screen.getByLabelText(/title/i), "Cylon portrayal");
    expect(screen.getByRole("button", { name: /^save document$/i })).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/content/i), "The reimagined series…");
    expect(screen.getByRole("button", { name: /^save document$/i })).toBeEnabled();
  });

  // Both terms holding Save down are VALIDITY rules, so a grey button here is not self-explanatory
  // the way "nothing to save yet" is — it has to name the field it is waiting for. The gate makes
  // `save()`'s own guard unreachable by click, so the caption is the only place the user can read
  // it.
  it("says WHY Save is grey, naming the field it is waiting for", async () => {
    render(<InterestDocumentsPane {...props} />);
    await userEvent.click(await screen.findByRole("button", { name: /add a document/i }));

    // A create form has no unchanged baseline to be quiet about, so it speaks on arrival.
    expect(screen.getByText("A title is required.")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/title/i), "Cylon portrayal");
    expect(screen.queryByText("A title is required.")).not.toBeInTheDocument();
    expect(
      screen.getByText("Content is required — it's what the persona searches."),
    ).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/content/i), "The reimagined series…");
    expect(
      screen.queryByText("Content is required — it's what the persona searches."),
    ).not.toBeInTheDocument();
  });

  // Whitespace is not content: the gate trims, so a form filled with spaces must stay blocked and
  // keep saying why rather than posting a document the persona can never match.
  it("treats a whitespace-only title or body as still missing", async () => {
    render(<InterestDocumentsPane {...props} />);
    await userEvent.click(await screen.findByRole("button", { name: /add a document/i }));
    await userEvent.type(screen.getByLabelText(/title/i), "   ");
    expect(screen.getByText("A title is required.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^save document$/i })).toBeDisabled();
  });
});

describe("KnowledgeFacet", () => {
  // The label InterestDocumentsPane/KnowledgeFacet render for a tab: "General › Topical › Specific".
  // `interestLabel` isn't exported, so these mirror it directly off the fixtures below.
  const LABEL_A = "Science Fiction › Space Opera › Battlestar Galactica";
  const LABEL_B = "Science Fiction › Space Opera › Firefly";

  const persona = {
    // An RDID, exactly what GET /persona/personas returns — the only form of a persona id any
    // client ever holds. `SpecialInterestRow.personaId` is the SAME string: the CRUD read path
    // swaps the stored uuid back to the rdid on the way out (crud/factory.ts's `refEntries`), so
    // there is no uuid anywhere on the wire to choose between.
    id: "persona.acme.bitbag",
    corpusEcosystemId: "eco-1",
    ownedEcosystemId: "owned-eco-1",
  } as unknown as Persona;

  // The facet's wiring guarantee: the act-as principal is the PERSONA being edited, and the
  // bucket/type addressed are the SELECTED interest's — three ids that are easy to cross while
  // every one of them is a plausible-looking string.
  it("acts as the persona under edit, against the selected interest's bucket", async () => {
    listInterests.mockResolvedValue([interest]);

    render(<KnowledgeFacet persona={persona} />);

    await userEvent.click(await screen.findByRole("button", { name: LABEL_A }));

    await waitFor(() => expect(listDocs).toHaveBeenCalled());
    expect(listInterests).toHaveBeenCalledWith(persona.id);
    expect(listDocs).toHaveBeenCalledWith("b1", "t1", persona.id);
  });

  // This `rerender` swaps the `persona` prop WITHOUT a remount — the unkeyed-host case, which is
  // deliberately not what the app does: `PersonasSection.tsx` renders `<PersonaEditor
  // key={openPersona.id}>`, so a rail switch remounts the facet and clears it for free. Both
  // `PersonaEditor` and `KnowledgeFacet` are exported from this package though, so an external
  // host can render either unkeyed — and there, refetching into shared state would leave the
  // previous persona's interests on screen until the new list settles, with a click opening
  // persona A's corpus under persona B's editor. What makes that safe is that the interests are
  // read from a cache entry NAMED by the persona, so B's unsettled read shows nothing rather than
  // A's tabs; the picked tab is cleared alongside it.
  it("drops the previous persona's interest tabs the moment the persona changes", async () => {
    const personaA = persona;
    const personaB = { ...persona, id: "persona.acme.other" } as unknown as Persona;

    listInterests.mockImplementation((id: string) =>
      // B's list never settles — the window this test is about.
      id === personaA.id ? Promise.resolve([interest]) : new Promise(() => {}),
    );

    const { rerender } = render(<KnowledgeFacet persona={personaA} />);
    await userEvent.click(await screen.findByRole("button", { name: LABEL_A }));
    expect(await screen.findByText(/nothing here yet/i)).toBeInTheDocument();

    rerender(<KnowledgeFacet persona={personaB} />);

    expect(screen.queryByRole("button", { name: LABEL_A })).not.toBeInTheDocument();
    expect(screen.queryByText(/nothing here yet/i)).not.toBeInTheDocument();
  });

  // RULING 2 regression pin — the documents on screen must belong to the interest named above
  // them, including during the window where the newly picked interest's read is still in flight.
  // Two things hold that now: the pane is keyed by the interest's id (so a switch remounts it
  // rather than reusing the instance and its draft state), and its documents are read from a cache
  // entry named by that interest's bucket (so the read can only ever land under the interest it
  // was made for).
  it("does not leak the previous interest's documents while a switch is in flight", async () => {
    const interestA = { ...interest, id: "iA", bucketId: "bA", bucketTypeId: "tA" };
    const interestB = {
      ...interest,
      id: "iB",
      bucketId: "bB",
      bucketTypeId: "tB",
      specific: "Firefly",
    };
    listInterests.mockResolvedValue([interestA, interestB]);

    let resolveB!: (v: unknown[]) => void;
    const bPending = new Promise<unknown[]>((res) => {
      resolveB = res;
    });
    listDocs.mockImplementation((bucketId: string) => {
      if (bucketId === "bA") {
        return Promise.resolve([
          { id: "dA", title: "DocA", content: "…", createdAt: "", updatedAt: "" },
        ]);
      }
      return bPending;
    });

    render(<KnowledgeFacet persona={persona} />);

    await userEvent.click(await screen.findByRole("button", { name: LABEL_A }));
    expect(await screen.findByText("DocA")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: LABEL_B }));

    // B's fetch hasn't resolved yet. A remounted pane shows no stale content from A.
    expect(screen.queryByText("DocA")).not.toBeInTheDocument();

    resolveB([]);
    await waitFor(() => expect(screen.getByText(/nothing here yet/i)).toBeInTheDocument());
  });
});
