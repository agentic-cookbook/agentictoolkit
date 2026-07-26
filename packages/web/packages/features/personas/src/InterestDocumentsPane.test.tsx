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

  // RULING 1 regression pin — the brief's four tests above all pass with `personaId` set to
  // EITHER the persona's rdid or its uuid, because their fixture happens to set both to the same
  // string. That's exactly what makes the underlying bug invisible: `access.group_members.member_id`
  // holds the persona's raw UUID (provisioning stamps it there — provision-interest-bucket.ts:252-253),
  // and bucketsData.ts's grant check (`assertActAsOwned` / `canBucketAccess`, routes/bucketsData.ts:
  // 203-234, 362, 428, 512, 564) passes the caller-supplied `asId` straight through UNRESOLVED. An
  // rdid never string-equals the stored uuid, so it 403s silently. This test pins that the pane's
  // OWN `personaId` prop reaches the client call verbatim, whatever shape it is handed.
  it("acts as the persona's uuid, not its rdid — the ACL matches member_id", async () => {
    // Regression pin: access.group_members.member_id holds the persona UUID (provisioning
    // inserts the resolved uuid), and bucketsData.ts passes the RAW asId straight to the grant
    // check without resolving an rdid. Sending `persona.id` (an rdid) is a silent 403.
    const uuidInterest = { ...interest, personaId: "3f1b0c2e-0000-4000-8000-000000000001" };
    render(<InterestDocumentsPane {...props} personaId={uuidInterest.personaId} interest={uuidInterest} />);
    await waitFor(() => expect(listDocs).toHaveBeenCalled());
    expect(listDocs).toHaveBeenCalledWith("b1", "t1", "3f1b0c2e-0000-4000-8000-000000000001");
  });
});

describe("KnowledgeFacet", () => {
  // The label InterestDocumentsPane/KnowledgeFacet render for a tab: "General › Topical › Specific".
  // `interestLabel` isn't exported, so these mirror it directly off the fixtures below.
  const LABEL_A = "Science Fiction › Space Opera › Battlestar Galactica";
  const LABEL_B = "Science Fiction › Space Opera › Firefly";

  const persona = {
    // Deliberately an RDID, exactly what GET /persona/personas returns — must NOT reach the pane
    // as the act-as principal. See RULING 1 above.
    id: "persona.acme.bitbag",
    corpusEcosystemId: "eco-1",
    ownedEcosystemId: "owned-eco-1",
  } as unknown as Persona;

  // RULING 1 regression pin, at the FACET layer this time — this is where the actual defect lived
  // (the pane just forwards whatever `personaId` it's handed). Mocks specialInterestsApi.list to
  // return one interest whose personaId is a UUID distinct from the parent persona's rdid `id`,
  // selects that interest's tab, and asserts the UUID — not the rdid — reaches interestDocumentsApi.list.
  it("passes the persona's uuid (interest.personaId), never the persona's rdid, as the act-as principal", async () => {
    const uuidPersonaId = "3f1b0c2e-0000-4000-8000-000000000001";
    const rowInterest = { ...interest, personaId: uuidPersonaId };
    listInterests.mockResolvedValue([rowInterest]);

    render(<KnowledgeFacet persona={persona} />);

    await userEvent.click(await screen.findByRole("button", { name: LABEL_A }));

    await waitFor(() => expect(listDocs).toHaveBeenCalled());
    expect(listDocs).toHaveBeenCalledWith("b1", "t1", uuidPersonaId);
  });

  // RULING 2 regression pin — KnowledgeFacet renders InterestDocumentsPane with no key, so
  // switching interests REUSES the component instance and its `docs` state carries over: the
  // previous interest's documents stay on screen under the new heading until the new fetch lands
  // (or forever, if it fails). `key={current.id}` forces a remount on switch, which resets `docs`
  // to `[]` immediately instead of showing stale content.
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
